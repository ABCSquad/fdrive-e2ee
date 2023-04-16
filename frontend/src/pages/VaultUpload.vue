<template>
  <!-- <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <input type="file" @change="uploadFile" />
      <button @click="getKeys">Get files</button>
      <pre>{{ token }}</pre>
    </div>
  </div> -->
  <div class="h-full" @contextmenu="toggleEmptyContext">
    <!-- Get resource and if error display -->
    <FolderContentsError
      v-if="$resources.folderContents.error"
      :error="$resources.folderContents.error" />

    <!-- Else GET all files and display in default grid view. -->
    <GridView
      v-else-if="$store.state.view === 'grid'"
      :folderContents="$resources.folderContents.data"
      :selectedEntities="selectedEntities"
      @entitySelected="(selected) => (selectedEntities = selected)"
      @openEntity="(entity) => openEntity(entity)"
      @showEntityContext="(event) => toggleEntityContext(event)"
      @showEmptyEntityContext="(event) => toggleEmptyContext(event)"
      @closeContextMenuEvent="closeContextMenu"
      @fetchFolderContents="() => $resources.folderContents.fetch()">
      <template #toolbar>
        <DriveToolBar
          :actionItems="actionItems"
          :breadcrumbs="breadcrumbs"
          :columnHeaders="columnHeaders"
          :showInfoButton="showInfoButton" />
      </template>
      <template #placeholder>
        <NoFilesSection />
      </template>
    </GridView>
  </div>
</template>

<script>
import { Button } from "frappe-ui";
import GridView from "@/components/GridView.vue";
import Dropzone from "dropzone";

import { Buffer } from "buffer";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import CryptoJS from "crypto-js";
import _ from "lodash";
let globalStore, sessionCipher;

import { formatSize, formatDate } from "@/utils/format";

export default {
  name: "VaultUpload",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button, GridView },
  data: () => ({
    dropzone: null,
    selectedEntities: [],
    previewEntity: null,
    showPreview: false,
    showNewFolderDialog: false,
    showRenameDialog: false,
    showShareDialog: false,
    showRemoveDialog: false,
    showEntityContext: false,
    showEmptyEntityContextMenu: false,
    entityContext: {},
    breadcrumbs: [{ label: "Home", route: "/" }],
  }),
  mounted() {
    this.initSession();

    window.addEventListener(
      "dragover",
      function (e) {
        e = e || event;
        e.preventDefault();
      },
      false
    );
    window.addEventListener(
      "drop",
      function (e) {
        e = e || event;
        e.preventDefault();
      },
      false
    );
    this.$store.commit("setHasWriteAccess", true);
    let componentContext = this;
    this.emitter.on("fetchFolderContents", () => {
      componentContext.$resources.folderContents.fetch();
    });
    this.dropzone = new Dropzone(this.$el.parentNode, {
      paramName: "file",
      parallelUploads: 1,
      autoProcessQueue: true,
      clickable: "#dropzoneElement",
      previewsContainer: "#dropzoneElement",
      uploadMultiple: false,
      chunking: true,
      forceChunking: true,
      url: "/api/method/drive.api.files.upload_file",
      maxFilesize: 10 * 1024, // 10GB
      /* timeout: 0, */
      chunkSize: 5 * 1024 * 1024, // 5MB
      headers: {
        "X-Frappe-CSRF-Token": window.csrf_token,
        Accept: "application/json",
      },
      sending: function (file, xhr, formData, chunk) {
        file.parent ? formData.append("parent", file.parent) : null;
        file.webkitRelativePath
          ? formData.append(
              "fullpath",
              file.webkitRelativePath.slice(
                0,
                file.webkitRelativePath.indexOf("/")
              )
            )
          : null;
        // WARNING: dropzone hidden input element click does not append fullPath to formdata thats why webkitRelativePath was used
        file.webkitRelativePath
          ? formData.append("fullpath", file.webkitRelativePath)
          : null;
        file.fullPath ? formData.append("fullpath", file.fullPath) : null;
      },
      params: function (files, xhr, chunk) {
        if (chunk) {
          return {
            uuid: chunk.file.upload.uuid,
            chunk_index: chunk.index,
            total_file_size: chunk.file.size,
            chunk_size: this.options.chunkSize,
            total_chunk_count: chunk.file.upload.totalChunkCount,
            chunk_byte_offset: chunk.index * this.options.chunkSize,
          };
        }
      },
    });
    this.dropzone.on("addedfile", function (file) {
      componentContext.$store.commit("pushToUploads", {
        uuid: file.upload.uuid,
        name: file.name,
        progress: 0,
      });
    });
    this.dropzone.on("uploadprogress", function (file, progress) {
      componentContext.$store.commit("updateUpload", {
        uuid: file.upload.uuid,
        progress: progress,
      });
    });
    this.dropzone.on("error", function (file, message, xhr) {
      let error_message;
      if (message._server_messages) {
        error_message = JSON.parse(message._server_messages)
          .map((element) => JSON.parse(element).message)
          .join("\n");
      }
      error_message = error_message || "Upload failed";
      componentContext.$store.commit("updateUpload", {
        uuid: file.upload.uuid,
        error: error_message,
      });
    });
    this.dropzone.on("complete", function (file) {
      componentContext.$resources.folderContents.fetch();
      componentContext.$store.commit("updateUpload", {
        uuid: file.upload.uuid,
        completed: true,
      });
    });
    this.emitter.on("uploadFile", () => {
      if (componentContext.dropzone.hiddenFileInput) {
        componentContext.dropzone.hiddenFileInput.click();
      }
    });
    this.emitter.on("uploadFolder", () => {
      if (componentContext.dropzone.hiddenFileInput) {
        componentContext.dropzone.hiddenFileInput.setAttribute(
          "webkitdirectory",
          true
        );
        componentContext.dropzone.hiddenFileInput.click();
      }
    });
  },
  unmounted() {
    this.$store.commit("setHasWriteAccess", false);
    this.dropzone.destroy();
  },
  methods: {
    async getKeys() {
      // Global variable
      let decryptedKeys = {};
      // Retrieve companionAddress
      const companionAddressString = localStorage.getItem("companionAddress");
      // Create signal protocol address
      const companionAddress =
        new window.libsignal.SignalProtocolAddress.fromString(
          companionAddressString
        );
      // Retrieve primary address
      const primaryAddressString = localStorage.getItem("primaryAddress");
      // Create signal protocol address
      const primaryAddress =
        new window.libsignal.SignalProtocolAddress.fromString(
          primaryAddressString
        );
      // Retrieve file keys from server
      const response = await fetch(
        `http://192.168.29.215:5000/api/user/${companionAddress.getName()}/${companionAddress.getDeviceId()}/key`
      );
      const responseData = await response.json();
      console.log(responseData.data);
      // Update global store
      this.reconstructStore();
      // Create session cipher to decrypt
      const sessionCipher = new window.libsignal.SessionCipher(
        globalStore,
        primaryAddress
      );
      // Update local storage store content
      this.storingSignalStore();
      const fileKeys = responseData.data.keys;
      // Filter fileKeys.keys to have their own companionAddress objects
      fileKeys.forEach((keyObject) => {
        keyObject.keys = keyObject.keys.filter(
          (key) => key.companionAddress === companionAddressString
        );
      });
      console.log(fileKeys);
      // Decrypt the keys
      await Promise.all(
        fileKeys.map(async (keyObject) => {
          const decryptedKey = await sessionCipher.decryptWhisperMessage(
            keyObject.keys[0].key.body,
            "binary"
          );
          // Convert to string
          const decryptedKeyString = Buffer.from(decryptedKey).toString("utf8");
          console.log(keyObject.file, decryptedKeyString);
          // Store decrypted keys in global variable
          decryptedKeys[keyObject.file] = decryptedKeyString;
        })
      );
    },
    async uploadFile($event) {
      try {
        const file = $event.target.files[0];
        // Generate key for AES using vue-cryptojs
        const keySize = 256 / 32; // AES-256
        const key = CryptoJS.lib.WordArray.random(keySize).toString();
        // TODO: Encrypt the file using AES and store it in the database
        // TODO: Retrieve the identifier of stored file to link with the key
        // Generate dummy identifier for file
        const fileId = Math.random().toString(36).substring(7);
        // Reconstruct store
        this.reconstructStore();
        // Create session cipher to encrypt
        const sessionCipher = new window.libsignal.SessionCipher(
          globalStore,
          new window.libsignal.SignalProtocolAddress.fromString(
            localStorage.getItem("primaryAddress")
          )
        );
        // Encrypt the key using the sessionCipher
        const encryptedKey = await sessionCipher.encrypt(
          Buffer.from(key).buffer
        );
        // Update local storage store content
        this.storingSignalStore();
        // Send file to server to store in database
        const response = await fetch(
          "http://192.168.29.215:5000/api/key/upload",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              file: fileId,
              companionAddress: localStorage.getItem("companionAddress"),
              username: localStorage.getItem("username"),
              key: encryptedKey,
            }),
          }
        );
        console.log({
          file: fileId,
          companionAddress: localStorage.getItem("companionAddress"),
          key: encryptedKey,
          keyPlain: key,
        });
      } catch (err) {
        console.log(err);
      }
    },
    async reconstructStore() {
      try {
        // Retrieve store content from local storage
        let store = JSON.parse(localStorage.getItem("companionSignalStore"));
        let primaryAddress = window.libsignal.SignalProtocolAddress.fromString(
          localStorage.getItem("primaryAddress")
        );
        // Convert all base64 strings to buffers
        store.identityKey.pubKey = Buffer.from(
          store.identityKey.pubKey,
          "base64"
        ).buffer;
        store.identityKey.privKey = Buffer.from(
          store.identityKey.privKey,
          "base64"
        ).buffer;
        // Create a signal store
        const companionSignalStore = new SignalProtocolStore();
        // Put the store content into the signal store
        companionSignalStore.put("identityKey", store.identityKey);
        companionSignalStore.put("registrationId", store.registrationId);
        companionSignalStore.storeSession(
          primaryAddress.toString(),
          store[`session${primaryAddress.toString()}`]
        );
        // Setting global store as the newly created store
        globalStore = companionSignalStore;
      } catch (err) {
        console.log(err);
      }
    },
    async storingSignalStore() {
      console.log("storingSignalStore", globalStore);
      // Create copy of store
      let storeContents = _.cloneDeep(globalStore.store);
      // Convert ArrayBuffer identityKeyPair to base64
      storeContents.identityKey.pubKey = Buffer.from(
        storeContents.identityKey.pubKey
      ).toString("base64");
      storeContents.identityKey.privKey = Buffer.from(
        storeContents.identityKey.privKey
      ).toString("base64");
      // Save store to local storage
      localStorage.setItem(
        "companionSignalStore",
        JSON.stringify(storeContents)
      );
    },
    openEntity(entity) {
      if (entity.is_group) {
        this.selectedEntities = [];
        this.$router.push({
          name: "Folder",
          params: { entityName: entity.name },
        });
      } else {
        this.previewEntity = entity;
        this.showPreview = true;
      }
    },
    hidePreview() {
      this.showPreview = false;
      this.previewEntity = null;
    },
    toggleEntityContext(event) {
      if (!event) this.showEntityContext = false;
      else {
        this.hidePreview();
        this.showEntityContext = true;
        this.showEmptyEntityContextMenu = false;
        this.entityContext = event;
      }
    },
    toggleEmptyContext(event) {
      if (!event) {
        this.showEntityContext = false;
        this.showEmptyEntityContextMenu = false;
      } else if (this.selectedEntities.length === 0) {
        this.selectedEntities = [];
        this.hidePreview();
        this.showEntityContext = false;
        this.showEmptyEntityContextMenu = true;
        this.entityContext = event;
      } else if (this.selectedEntities.length > 0) {
        this.hidePreview();
        this.showEntityContext = true;
        this.showEmptyEntityContextMenu = false;
        this.entityContext = event;
      }
    },
    closeContextMenu() {
      this.showEntityContext = false;
      this.showEmptyEntityContextMenu = false;
      this.entityContext = undefined;
    },
  },
  resources: {
    folderContents() {
      return {
        url: "drive.api.files.list_folder_contents",
        params: {
          order_by: this.orderBy,
          fields:
            "name,title,is_group,owner,modified,file_size,mime_type,creation",
        },
        onSuccess(data) {
          this.$resources.folderContents.error = null;
          data.forEach((entity) => {
            entity.size_in_bytes = entity.file_size;
            entity.file_size = entity.is_group
              ? "-"
              : formatSize(entity.file_size);
            entity.modified = formatDate(entity.modified);
            entity.creation = formatDate(entity.creation);
            entity.owner = "me";
          });
        },
        auto: true,
      };
    },
  },
};
</script>
