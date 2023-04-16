<template>
  <div class="h-full w-full">
    <!-- <div class="h-full flex flex-col justify-center items-center">
      <Button @click="generateQR()">Generate QR</Button>
      <pre>{{ token }}</pre>
      <qrcode-vue :value="token" :size="size" level="H" />
    </div> -->
    <div class="h-full flex flex-row justify-center items-center">
      <div class="flex flex-col justify-start items-center p-5">
        <div class="qr-info-screen bg-grey">
          <div class="flex flex-row justify-start items-center">
            <FrappeLogo class="h-5 w-auto mr-3" />
            <div class="text-2xl font-bold qr-heading">
              Start Using FDrive Vault on your computer.
            </div>
          </div>

          <div class="qr-steps mt-10 p-5">
            <ol class="list-decimal">
              <li class="mt-2">
                Download or Open FDrive Authenticator on your mobile device
              </li>
              <li class="mt-2">Click on the Floating Action Button</li>
              <li class="mt-2">Select the Scan QR Code Option</li>
              <li class="mt-2">
                Point your phone to this screen to capture the QR code
              </li>
            </ol>
          </div>
        </div>
      </div>
      <div class="flex flex-col justify-start items-center ml-5 p-5 qr-field">
        <!-- <Button @click="generateQR()">Generate QR</Button>
        
        <qrcode-vue :value="token" :size="size" level="H" /> -->
        <div class="w-100 h-100 relative z-0">
          <qrcode-vue
            :class="!isGenerated && 'blur-md'"
            :value="token"
            :size="size"
            level="H" />
          <div
            v-if="!isGenerated"
            class="w-100 h-100 absolute inset-0 flex justify-center items-center z-10">
            <!-- <pre>{{ token }}</pre> -->
            <Button
              icon-right="lock"
              appearance="primary"
              @click="generateQR()">
              Access Vault
              <!-- <FeatherIcon
                name="lock"
                class="stroke-1.5 w-4 h-4 text-white-700" /> -->
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Button } from "frappe-ui";
import QrcodeVue from "qrcode.vue";
import { Buffer } from "buffer";
import platform from "platform";
import SignalProtocolStore from "libsignal-protocol/test/InMemorySignalProtocolStore.js";
import FrappeLogo from "@/components/FrappeLogo.vue";

export default {
  name: "Vault",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button, QrcodeVue, FrappeLogo },
  data: () => ({
    token: "tinyurl.com/3acwfenx",
    size: 400,
    isGenerated: false,
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
        const socket = new WebSocket(`ws://192.168.29.215:7071/initiate`);
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
            // Save store to local storage
            localStorage.setItem(
              "companionSignalStore",
              JSON.stringify(storeContents)
            );
            // Save username to local storage
            localStorage.setItem("username", primaryAddress.getName());
            // Save primaryAddress to local storage
            localStorage.setItem("primaryAddress", primaryAddress.toString());
            // Save companionAddress to local storage
            localStorage.setItem(
              "companionAddress",
              companionAddress.toString()
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
