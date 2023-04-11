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
        const openRequest = window.indexedDB.open("myDatabase", 1);

        openRequest.onupgradeneeded = function (event) {
          const db = event.target.result;
          const objectStore = db.createObjectStore("myObjectStore", {
            keyPath: "id",
          });
        };

        openRequest.onsuccess = function (event) {
          const db = event.target.result;
          const transaction = db.transaction("myObjectStore", "readonly");
          const objectStore = transaction.objectStore("myObjectStore");

          const primaryAddressRequest = objectStore.get(
            "primarySignalProtocolAddress"
          );
          const companionSignalStoreRequest = objectStore.get(
            "companionSignalStore"
          );

          primaryAddressRequest.onsuccess = function () {
            const primaryAddress =
              window.libsignal.SignalProtocolAddress.fromString(
                primaryAddressRequest.result.value
              );

            companionSignalStoreRequest.onsuccess = function () {
              const companionSignalStore =
                companionSignalStoreRequest.result.value.store;

              const companionSignalStoreInstance = new SignalProtocolStore();
              for (let key in companionSignalStore) {
                companionSignalStoreInstance.put(
                  key,
                  companionSignalStore[key]
                );
              }

              console.log(companionSignalStoreInstance);
              const sessionCipher = new window.libsignal.SessionCipher(
                companionSignalStoreInstance,
                primaryAddress
              );
              const plaintextMessage = Buffer.from(
                "Take a sad song, and make it better",
                "utf-8"
              ).buffer;
              // Encrypt test message using cipher
              sessionCipher.encrypt(plaintextMessage).then((ciphertext) => {
                console.log(ciphertext);
              });
            };

            companionSignalStoreRequest.onerror = function (event) {
              console.error(
                "Error retrieving companionSignalStore from IndexedDB",
                event.target.error
              );
            };
          };

          primaryAddressRequest.onerror = function (event) {
            console.error(
              "Error retrieving primarySignalProtocolAddress from IndexedDB",
              event.target.error
            );
          };
        };

        openRequest.onerror = function (event) {
          console.error("Error opening IndexedDB", event.target.error);
        };
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
