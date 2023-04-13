<template>
  <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <Button @click="generateQR()">Generate QR</Button>
      <pre>{{ token }}</pre>
      <qrcode-vue :value="token" :size="size" level="H" />
    </div>
  </div>
</template>

<script>
import { Button } from "frappe-ui";
import QrcodeVue from "qrcode.vue";
import { Buffer } from "buffer";
import platform from "platform";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";

export default {
  name: "Vault",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button, QrcodeVue },
  data: () => ({
    token: null,
    size: 300,
  }),
  methods: {
    async generateIdentity(store) {
      const result = await Promise.all([
        window.libsignal.KeyHelper.generateIdentityKeyPair(),
        window.libsignal.KeyHelper.generateRegistrationId(),
      ]);
      store.put("identityKey", result[0]);
      store.put("registrationId", result[1]);
    },
    async generateQR() {
      try {
        // Connect to websocket connection
        const socket = new WebSocket(`ws://localhost:7071/initiate`);
        // Create a signal store
        const companionSignalStore = new SignalProtocolStore();
        let primaryAddress, companionAddress;
        socket.onopen = () => {
          console.log("Connected to websocket");
        };
        socket.onmessage = async (event) => {
          // Determine type of message
          const message = JSON.parse(event.data);
          // If success message
          if (message.type === "success") {
            this.token = message.token;
          }
          if (message.type === "primaryInformation") {
            // Generate identity
            await this.generateIdentity(companionSignalStore);
            // Create primary address from string
            primaryAddress = window.libsignal.SignalProtocolAddress.fromString(
              message.data.primarySignalProtocolAddress
            );
            // Generate companion address
            companionAddress = new window.libsignal.SignalProtocolAddress(
              await primaryAddress.getName(),
              await companionSignalStore.getLocalRegistrationId()
            );
            // Create session builder
            const sessionBuilder = new window.libsignal.SessionBuilder(
              companionSignalStore,
              primaryAddress
            );
            // Convert base64 strings to buffers in preKeyBundle
            let preKeyBundle = Object.assign({}, message.data.preKeyBundle);
            preKeyBundle.identityKey = Buffer.from(
              preKeyBundle.identityKey,
              "base64"
            ).buffer;
            preKeyBundle.preKey.publicKey = Buffer.from(
              preKeyBundle.preKey.publicKey,
              "base64"
            ).buffer;
            preKeyBundle.signedPreKey.publicKey = Buffer.from(
              preKeyBundle.signedPreKey.publicKey,
              "base64"
            ).buffer;
            preKeyBundle.signedPreKey.signature = Buffer.from(
              preKeyBundle.signedPreKey.signature,
              "base64"
            ).buffer;
            await sessionBuilder.processPreKey(preKeyBundle);

            const preKeyWhisperMessage = Buffer.from(
              "Hey Jude, don't make it bad"
            ).buffer;
            const sessionCipher = new window.libsignal.SessionCipher(
              companionSignalStore,
              primaryAddress
            );
            const ciphertext = await sessionCipher.encrypt(
              preKeyWhisperMessage
            );
            socket.send(
              JSON.stringify({
                type: "preKeyWhisperMessage",
                data: {
                  ciphertext: ciphertext,
                  companionSignalProtocolAddress: companionAddress.toString(),
                  deviceInfo: {
                    name: platform.name,
                    version: platform.version,
                    os: platform.os,
                    lastLogin: new Date().toISOString(),
                    location: "Mumbai, IN",
                  },
                },
              })
            );
          }
          if (message.type === "whisperMessage") {
            // Decrypt message
            const sessionCipher = new window.libsignal.SessionCipher(
              companionSignalStore,
              primaryAddress
            );
            const decryptedMessage = await sessionCipher.decryptWhisperMessage(
              message.data.whisperMessage.body,
              "binary"
            );
            console.log(
              "Decrypted message",
              Buffer.from(decryptedMessage).toString("utf8")
            );
            // Create copy of store
            let storeContents = Object.assign({}, companionSignalStore.store);
            // Convert ArrayBuffer identityKeyPair to base64
            storeContents.identityKey.pubKey = Buffer.from(
              storeContents.identityKey.pubKey
            ).toString("base64");
            storeContents.identityKey.privKey = Buffer.from(
              storeContents.identityKey.privKey
            ).toString("base64");
            // Save primaryAddress to local storage
            localStorage.setItem("primaryAddress", primaryAddress.toString());
            // Save store to local storage
            localStorage.setItem(
              "companionSignalStore",
              JSON.stringify(storeContents)
            );
            console.log("Store contents saved to local storage");
          }
        };
        socket.onclose = (event) => {
          if (event.wasClean) {
            console.log("Connection closed cleanly");
          } else {
            console.log("Connection died");
          }
          console.log(`Code: ${event.code} | Reason: ${event.reason}`);
        };
        socket.onerror = (error) => {
          console.log(`Error: ${error.message}`);
        };
      } catch (err) {
        console.log(err.message);
      }
    },
  },
};
</script>
