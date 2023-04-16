<template>
  <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <input type="file" @change="uploadFile" />
      <button @click="getKeys">Get files</button>
      <pre>{{ token }}</pre>
    </div>
  </div>
</template>

<script>
import { Button } from "frappe-ui";
import { Buffer } from "buffer";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import CryptoJS from "crypto-js";
import _ from "lodash";
let globalStore, sessionCipher;

export default {
  name: "Vault",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button },
  data: () => ({
    token: null,
    size: 300,
  }),
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
  },
  mounted() {},
};
</script>
