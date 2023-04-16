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
        </label>
      </div>
    </div>

    <div class="text-gray-600 font-medium mt-8">Files</div>

    <div class="h-full w-full flex flex-row jusitfy-evenly gap-5 mt-5">
      <div v-for="(item, index) in files" :key="index" class="flex flex-col">
        <div class="md:w-[212px] rounded-lg border group select-none entity">
          <div class="h-28 md:h-32 place-items-center grid">
            <img
              :src="
                getIconUrl(formatMimeType(getIconFromIdentifier(item.name)))
              "
              class="h-14"
              :draggable="false" />
          </div>
          <div class="px-3.5 md:h-16 content-center grid">
            <h3 class="truncate text-[14px] font-medium">
              {{ getNameFromIndentifier(item.name) }}
            </h3>
            <div
              class="truncate text-sm text-gray-600 flex mt-1 place-items-center">
              <img
                :src="getIconUrl(formatMimeType('jpeg'))"
                class="h-3.5 mr-1.5" />
              <p>{{ getFileSubtitle(item.name) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Button, FeatherIcon } from "frappe-ui";
import { Buffer } from "buffer";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import CryptoJS from "crypto-js";
import { uuid } from "vue-uuid";
import _ from "lodash";
import getIconUrl from "@/utils/getIconUrl";
import { formatMimeType } from "@/utils/format";

let globalStore, sessionCipher;

import { storage } from "../firebase.js";
import { ref, uploadBytes, listAll } from "firebase/storage";
import { callbackify } from "util";

export default {
  name: "VaultUpload",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button, FeatherIcon },
  setup() {
    return { getIconUrl, formatMimeType };
  },
  data: () => ({
    files: [],
  }),
  mounted() {
    this.getAllFiles();
    this.getKeys();
  },

  methods: {
    chooseFiles: function () {
      document.getElementById("fileUpload").click();
    },

    getNameFromIndentifier(filename) {
      const re = /\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/;
      let result = filename.replace(re, "");
      while (result.charAt(0) === "_") {
        result = result.substring(1);
      }
      return result;
    },

    getIconFromIdentifier(filename) {
      // Remove .enc
      const encRemoved = filename.substr(0, filename.length - 4);
      const extension = encRemoved.split(".").pop();
      console.log(extension);
      switch (extension) {
        case "jpeg":
          return "image";

        case "mp4":
          return "video";

        case "mp3":
          return "audio";

        case "pdf":
          return "pdf";

        case "xlsx":
          return "vnd.openxmlformats-officedocument.spreadsheetml.sheet";

        case "ppt":
          return "vnd.openxmlformats-officedocument.presentationml.presentation";

        case "docx":
          return "vnd.openxmlformats-officedocument.wordprocessingml.document";
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
      let fileId;
      var reader = new FileReader();
      reader.onload = () => {
        var wordArray = CryptoJS.lib.WordArray.create(reader.result); // Convert: ArrayBuffer -> WordArray
        var encrypted = CryptoJS.AES.encrypt(wordArray, key).toString(); // Encryption: I: WordArray -> O: -> Base64 encoded string (OpenSSL-format)

        var fileEnc = new Blob([encrypted]); // Create blob from string
        var filename = file.name + ".enc";

        fileId = this.upload(fileEnc, filename);
      };
      reader.readAsArrayBuffer(file);
      return fileId;
    },

    decrypt(file) {
      var reader = new FileReader();
      reader.onload = () => {
        var key = "1234567887654321";

        var decrypted = CryptoJS.AES.decrypt(reader.result, key); // Decryption: I: Base64 encoded string (OpenSSL-format) -> O: WordArray
        var typedArray = this.convertWordArrayToUint8Array(decrypted); // Convert: WordArray -> typed array

        var fileDec = new Blob([typedArray]); // Create blob from typed array

        var a = document.createElement("a");
        var url = window.URL.createObjectURL(fileDec);

        // Remove .enc appended during encryption
        var filename = file.name.substr(0, file.name.length - 4);
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      };
      reader.readAsText(file);
    },

    upload(encryptedBlob, filename) {
      const storageRef = ref(storage, `vault/${uuid.v4()}_${filename}`);
      uploadBytes(storageRef, encryptedBlob)
        .then((snapshot) => {
          console.log("uploaded", snapshot);
          this.getAllFiles();

          return snapshot.metadata.name;
        })
        .catch((err) => {
          console.log(err);
        });
    },

    testDecrypt() {
      console.log(this.$refs.fileUploadDecrypt.files[0]);
      this.decrypt(this.$refs.fileUploadDecrypt.files[0]);
    },

    getAllFiles() {
      const listRef = ref(storage, "vault");
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
    async uploadFile(event) {
      try {
        const file = event.target.files[0];
        // Generate key for AES using vue-cryptojs
        const keySize = 256 / 32; // AES-256
        const key = CryptoJS.lib.WordArray.random(keySize).toString();
        // TODO: Encrypt the file using AES and store it in the database
        const fileId = this.encrypt(file, key);
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
