<template>
  <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <input type="file" @change="uploadFile" />
      <pre>{{ token }}</pre>
    </div>
  </div>
</template>

<script>
import { Button } from "frappe-ui";
import { Buffer } from "buffer";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import CryptoJS from "crypto-js";
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
    async uploadFile($event) {
      try {
        const file = $event.target.files[0];
        // Logging the cipher and store
        console.log(sessionCipher, globalStore);
        // Generate key for AES using vue-cryptojs
        const keySize = 256 / 32; // AES-256
        const key = CryptoJS.lib.WordArray.random(keySize).toString();
        // TODO: Encrypt the file using AES and store it in the database
        // TODO: Retrieve the identifier of stored file to link with the key
        // Generate dummy identifier for file
        const fileId = Math.random().toString(36).substring(7);
        // Encrypt the key using the sessionCipher
        const encryptedKey = await sessionCipher.encrypt(
          Buffer.from(key).buffer
        );
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
        console.log(err.message);
      }
    },
    async initSession() {
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
        // Creating a sessionCipher object
        sessionCipher = new window.libsignal.SessionCipher(
          globalStore,
          primaryAddress
        );
      } catch (err) {
        console.log(err);
      }
    },
  },
  mounted() {
    this.initSession();
  },
};
</script>
