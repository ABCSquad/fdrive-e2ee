<template>
  <div class="h-full w-full">
    <!-- <div class="w-full flex flex-row justify-end items-center">
      <input ref="fileUploadDecrypt" type="file" />
      <Button @click="testDecrypt">Decrypt</Button>
      <Button @click="getAllFiles">Get all files</Button>
    </div> -->
    <div class="header w-full flex flex-row justify-between">
      <div class="vault-heading">
        <div class="flex flex-row justify-start items-center">
          <div>
            <FeatherIcon
              name="lock"
              class="stroke-1.5 w-8 h-8 text-black-700" />
          </div>
          <div class="ml-3">
            <div class="text-2xl font-bold">Secure Vault</div>
            <div class="text-sm">End-to-end encryption</div>
          </div>
        </div>
      </div>

      <div class="vault-upload">
        <label>
          <input
            id="fileUpload"
            ref="fileUpload"
            type="file"
            hidden
            @change="uploadFile" />
          <Button appearance="primary" icon-left="plus" @click="chooseFiles()">
            Upload a file
          </Button>
          <!-- <Button v-if="selectedEntity" @click="download">
            Download {{ getNameFromIndentifier(selectedEntity) }}
          </Button> -->

          <!-- <Button v-if="selectedEntity" @click="preview">Preview</Button> -->
        </label>
      </div>
    </div>

    <div class="text-gray-600 font-medium mt-8">Files {{ userId }}</div>

    <div
      class="w-full flex flex-row flex-wrap jusitfy-evenly items-start gap-5 mt-5">
      <div v-for="(item, index) in files" :key="index" class="flex flex-col">
        <div
          :id="item.name"
          :key="item.name"
          class="md:w-[212px] rounded-lg border group select-none entity"
          :class="
            selectedEntity === item.name ? 'bg-blue-100' : 'hover:bg-blue-50'
          "
          @dblclick="preview"
          @contextmenu="
            (event) => {
              handleSelect(item.name);
              toggleEntityContext({ x: event.clientX, y: event.clientY });
            }
          "
          @click="(event) => handleSelect(item.name)">
          <div class="h-28 md:h-32 place-items-center grid">
            <img
              :src="
                getIconUrl(formatMimeType(getIconFromIdentifier(item.name)))
              "
              class="h-14 blur-sm"
              :class="getIfDecryptable(item.name) && 'blur-none'"
              :draggable="false" />
          </div>
          <div class="px-3.5 md:h-16 content-center grid">
            <h3
              class="truncate text-[14px] font-medium blur-sm"
              :class="getIfDecryptable(item.name) && 'blur-none'">
              {{ getNameFromIndentifier(item.name) }}
            </h3>
            <div
              class="truncate text-sm text-gray-600 flex mt-1 place-items-center">
              <img
                :src="getIconUrl(formatMimeType('jpeg'))"
                class="h-3.5 mr-1.5 blur-sm"
                :class="getIfDecryptable(item.name) && 'blur-none'" />
              <div class="w-full flex flex-row justify-between items-center">
                <p
                  class="blur-sm"
                  :class="getIfDecryptable(item.name) && 'blur-none'">
                  {{ getFileSubtitle(item.name) }}
                </p>
                <!-- <p>{{ getIfDecryptable(item.name) }}</p> -->
                <Tooltip text="Waiting for this file. Check your phone.">
                  <FeatherIcon
                    v-if="!getIfDecryptable(item.name)"
                    name="lock"
                    class="stroke-1.5 w-4 h-4 text-black-700" />
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EntityContextMenu
      v-if="showEntityContext"
      :entityName="selectedEntity"
      :actionItems="actionItems"
      :entityContext="entityContext"
      :close="closeContextMenu" />

    <FilePreview
      v-if="showPreview"
      @hide="hidePreview"
      :previewEntity="previewEntity"
      :isVault="true"
      :decryptKey="decryptKey" />
  </div>
</template>

<script>
import { Button, FeatherIcon, Tooltip } from "frappe-ui";
import EntityContextMenu from "@/components/EntityContextMenu.vue";
import FilePreview from "@/components/FilePreview.vue";

import { Buffer } from "buffer";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import CryptoJS from "crypto-js";
import { uuid } from "vue-uuid";
import _ from "lodash";
import getIconUrl from "@/utils/getIconUrl";
import { formatMimeType } from "@/utils/format";

let globalStore,
  decryptedKeys = {},
  sessionCipher;
let globalKeyData;
import { storage } from "../firebase.js";
import { ref, uploadBytes, listAll, getBlob } from "firebase/storage";

export default {
  name: "VaultUpload",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button, FeatherIcon, Tooltip, EntityContextMenu, FilePreview },

  setup() {
    return { getIconUrl, formatMimeType };
  },

  data: () => ({
    showEntityContext: false,
    selectedEntity: "",
    entityContext: {},
    showPreview: false,
    previewEntity: null,
    decryptKey: null,
    files: [],
    keyData: {
      missingKeys: [
        {
          _id: "643d96e77845eda66887d1d3",
          file: "85c2e9ed-e1ab-4065-8e93-4353b479158b_download.jpeg.enc",
          owner: "643d949a7845eda66887d198",
          keys: [
            {
              companionAddress: "test.4379",
              key: {
                type: 1,
                body: `test`,
                registrationId: 9882,
              },
              uploader: true,
              sameChainEncrypted: true,
              _id: "643d96e77845eda66887d1d4",
            },
          ],
          __v: 0,
        },
      ],
      keys: [
        {
          _id: "643d95227845eda66887d1ac",
          file: "df8c9838-3dbd-446d-a36e-d0c2ffea2a51_QuestPostmanDump_v12.json.enc",
          owner: "643d949a7845eda66887d198",
          keys: [
            {
              companionAddress: "test.4379",
              key: {
                type: 1,
                body: '3\n!\u0005£I³Yï°ÑO@E\u0015ºÙqÝ£©BÜ§îZCR~SuR\r\u0010\u0001\u0018\u0000" \u0017öÛ\u0003?Õ%i\u0006ØoÞØ\u001fN³ÑYko,/"h/§cI*nYyè¤',
                registrationId: 4379,
              },
              uploader: true,
              sameChainEncrypted: false,
              _id: "643d95227845eda66887d1ad",
            },
          ],
          __v: 0,
        },
      ],
    },
  }),

  computed: {
    userId() {
      console.log(this.$store.state.auth.user_id);
      return null;
    },

    actionItems() {
      return [
        {
          label: "Download",
          icon: "download",
          handler: () => this.download(),
        },
        {
          label: "View details",
          icon: "info",
          handler: () => {
            this.$store.commit("setShowInfo", true);
          },
        },

        {
          label: "Preview",
          icon: "eye",
          handler: () => this.preview(),
        },
      ];
    },
  },
  mounted() {
    this.getAllFiles();
    this.getKeys();
  },

  methods: {
    chooseFiles: function () {
      document.getElementById("fileUpload").click();
    },

    handleSelect(file) {
      this.selectedEntity = file;
    },
    toggleEntityContext(event) {
      if (!event) this.showEntityContext = false;
      else {
        // this.hidePreview();
        // this.showEmptyEntityContextMenu = false;
        this.entityContext = event;
        this.showEntityContext = true;
      }
    },
    closeContextMenu() {
      this.showEntityContext = false;
      // this.showEmptyEntityContextMenu = false;
      this.entityContext = undefined;
    },
    getIfDecryptable(fileId) {
      const checkIfExists = (obj) => obj.file === fileId;
      // return globalKeyData.keys.some(checkIfExists);
      return true;
    },

    getNameFromIndentifier(filename) {
      const re = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/;
      let result = filename.replace(re, "");
      while (result.charAt(0) === "_") {
        result = result.substring(1);
      }
      const encRemoved = result.substr(0, result.length - 4);
      return encRemoved;
    },

    getIconFromIdentifier(filename) {
      // Remove .enc
      const encRemoved = filename.substr(0, filename.length - 4);
      const extension = encRemoved.split(".").pop();
      switch (extension) {
        case "jpeg":
        case "jpg":
        case "png":
          return `image/${extension}`;

        case "txt":
          return "text/plain";

        case "json":
          return "application/json";

        case "js":
          return "application/javascript";

        case "mp4":
          return "video";

        case "mp3":
          return "audio";

        case "pdf":
          return "application/pdf";

        case "xlsx":
        case "xls":
        case "csv":
          return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        case "ppt":
          return "application/vnd.openxmlformats-officedocument.presentationml.presentation";

        case "doc":
          return "application/msword";

        case "docx":
          return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default:
          return "unknown";
      }
    },

    getFileSubtitle(file) {
      let fileSubtitle = formatMimeType(this.getIconFromIdentifier(file));
      fileSubtitle =
        fileSubtitle.charAt(0).toUpperCase() + fileSubtitle.slice(1);
      return `${fileSubtitle}`;
    },

    convertWordArrayToUint8Array(wordArray) {
      var arrayOfWords = wordArray.hasOwnProperty("words")
        ? wordArray.words
        : [];
      var length = wordArray.hasOwnProperty("sigBytes")
        ? wordArray.sigBytes
        : arrayOfWords.length * 4;
      var uInt8Array = new Uint8Array(length),
        index = 0,
        word,
        i;
      for (i = 0; i < length; i++) {
        word = arrayOfWords[i];
        uInt8Array[index++] = word >> 24;
        uInt8Array[index++] = (word >> 16) & 0xff;
        uInt8Array[index++] = (word >> 8) & 0xff;
        uInt8Array[index++] = word & 0xff;
      }
      return uInt8Array;
    },

    encrypt(file, key) {
      return new Promise((resolve, reject) => {
        var reader = new FileReader();
        reader.onload = async () => {
          var key = "1234567887654321";
          var wordArray = CryptoJS.lib.WordArray.create(reader.result); // Convert: ArrayBuffer -> WordArray
          var encrypted = CryptoJS.AES.encrypt(wordArray, key).toString(); // Encryption: I: WordArray -> O: -> Base64 encoded string (OpenSSL-format)

          var fileEnc = new Blob([encrypted]); // Create blob from string
          var filename = file.name + ".enc";

          try {
            const fileId = await this.upload(fileEnc, filename);
            resolve(fileId);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    },
    decrypt(file, fileName, key, type) {
      var reader = new FileReader();
      reader.onload = () => {
        var key = "1234567887654321";

        var decrypted = CryptoJS.AES.decrypt(reader.result, key); // Decryption: I: Base64 encoded string (OpenSSL-format) -> O: WordArray
        var typedArray = this.convertWordArrayToUint8Array(decrypted); // Convert: WordArray -> typed array

        var fileDec = new Blob([typedArray]); // Create blob from typed array

        var a = document.createElement("a");
        var url = window.URL.createObjectURL(fileDec);
        console.log(url);
        // Remove .enc appended during encryption
        var filename = fileName.substr(0, fileName.length - 4);
        a.href = url;
        a.download = this.getNameFromIndentifier(filename);
        a.click();
        window.URL.revokeObjectURL(url);
      };
      reader.readAsText(file);
    },

    async upload(encryptedBlob, filename) {
      const storageRef = ref(
        storage,
        `vault/${this.$store.state.auth.user_id}/${uuid.v4()}_${filename}`
      );
      const snapshot = await uploadBytes(storageRef, encryptedBlob);
      console.log("uploaded", snapshot);
      this.getAllFiles();
      return snapshot.metadata.name;
    },

    download() {
      const downloadRef = ref(
        storage,
        `vault/${this.$store.state.auth.user_id}/${this.selectedEntity}`
      );
      getBlob(downloadRef)
        .then((resBlob) => {
          this.decrypt(
            resBlob,
            this.selectedEntity,
            decryptedKeys[this.selectedEntity],
            "DOWNLOAD"
          );
        })
        .catch((err) => console.log(err));
    },

    preview() {
      this.decryptKey = decryptedKeys[this.selectedEntity];
      this.previewEntity = {
        name: this.selectedEntity,
        mime_type: this.getIconFromIdentifier(this.selectedEntity),
      };
      console.log("preview enity", this.previewEntity);
      this.showPreview = true;
    },

    hidePreview() {
      this.showPreview = false;
      this.previewEntity = null;
    },

    testDecrypt() {
      console.log(this.$refs.fileUploadDecrypt.files[0]);
      this.decrypt(this.$refs.fileUploadDecrypt.files[0]);
    },

    getAllFiles() {
      const listRef = ref(storage, `vault/${this.$store.state.auth.user_id}/`);
      listAll(listRef)
        .then((res) => {
          console.log(res);
          this.files = res.items;
        })
        .catch((error) => {
          console.log(error);
        });
    },

    async getKeys() {
      // Global variable

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
      // this.keyData = responseData.data;
      globalKeyData = _.cloneDeep(responseData.data);
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
    async uploadFile(event) {
      try {
        const file = event.target.files[0];
        // Generate key for AES using vue-cryptojs
        const keySize = 256 / 32; // AES-256
        const key = CryptoJS.lib.WordArray.random(keySize).toString();
        // TODO: Encrypt the file using AES and store it in the database
        const fileId = await this.encrypt(file, key);
        console.log(fileId);
        // Generate dummy identifier for file
        // const fileId = Math.random().toString(36).substring(7);
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
  },
};
</script>
