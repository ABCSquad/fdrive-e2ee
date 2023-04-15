<template>
  <!-- <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <input type="file" @change="uploadFile" />
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
    async uploadFile($event) {
      try {
        const file = $event.target.files[0];
        // perform file upload logic here
        console.log(file);
      } catch (err) {
        console.log(err.message);
      }
    },
    async initSession() {
      try {
        // Get companionAddress from localStorage
        let primaryAddress = localStorage.getItem(
          "primarySignalProtocolAddress"
        );
        // Parse companionAddress
        primaryAddress = primaryAddress;
        // Get companionSignalStore from localStorage
        let companionSignalStore = localStorage.getItem("companionSignalStore");
        // If any is null, throw an error
        if (!companionSignalStore || !primaryAddress) {
          throw new Error("You need to login to Vault first! Click on Vault");
        }
        // Parse companionSignalStore
        companionSignalStore = JSON.parse(companionSignalStore);
        // Create companionSignalStore instance
        let companionSignalStoreInstance = new SignalProtocolStore();
        // Add all keys from companionSignalStore to companionSignalStoreInstance
        for (let key in companionSignalStore) {
          companionSignalStoreInstance.store[key] = companionSignalStore[key];
        }
        console.log(companionSignalStoreInstance);
        // Check if sessionStore has a session
        let sessionRecord =
          companionSignalStoreInstance.store[
            "session" + primaryAddress.toString()
          ];

        // Create sessionCipher
        const sessionCipher = new window.libsignal.SessionCipher(
          companionSignalStoreInstance,
          primaryAddress
        );
        console.log(sessionCipher, "sessionCipher");
        let plaintextMessage = Buffer.from(
          "Take a sad song, and make it better",
          "utf-8"
        ).buffer;
        // Encrypt test message using cipher
        sessionCipher.encrypt(plaintextMessage).then((ciphertext) => {
          console.log(ciphertext);
        });
      } catch (err) {
        console.log(err.message);
      }
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
