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
  },
  mounted() {
    this.initSession();
  },
};
</script>
