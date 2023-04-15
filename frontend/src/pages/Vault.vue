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
import toArrayBuffer from "to-arraybuffer";
import ByteBuffer from "bytebuffer";
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
    async generateQR() {
      try {
        const res = await fetch(`http://localhost:5000/api/session/initiate`, {
          method: "GET",
          headers: {
            Connection: "Upgrade",
            Upgrade: "websocket",
            "Sec-WebSocket-Version": 13,
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
          },
        });

        if (!res.ok) {
          this.isGenerated = false;
          const message = `An error has occured: ${res.status} - ${res.statusText}`;
          throw new Error(message);
        }

        const data = await res.json();

        const result = {
          status: res.status + "-" + res.statusText,
          headers: {
            "Content-Type": res.headers.get("Content-Type"),
            "Content-Length": res.headers.get("Content-Length"),
          },
          length: res.headers.get("Content-Length"),
          data: data,
        };

        this.isGenerated = true;
        this.token = result.data.data;

        // Connect to websocket connection
        const socket = new WebSocket(
          `ws://localhost:5000/companion/${this.token}`
        );
        socket.onopen = () => {
          console.log("Connected to websocket");
        };
        socket.onmessage = async (event) => {
          // Determine type of message
          const receivedMessage = JSON.parse(event.data);
          // If message is a greeting
          if (receivedMessage.type === "greeting") {
            console.log(`Server says: ${receivedMessage.message}`);
          }
          // If message is a prekey bundle
          if (receivedMessage.type === "primaryPreKeyBundle") {
            // Create a new signalStores
            const primarySignalStore = new SignalProtocolStore();
            const companionSignalStore = new SignalProtocolStore();

            // Get primary device related data
            const primarySignalProtocolAddress =
              window.libsignal.SignalProtocolAddress.fromString(
                receivedMessage.primarySignalProtocolAddress
              );
            let primaryPreKeyBundle = receivedMessage.preKeyBundle;
            // Convert all keys in preKeyBundle to Buffers
            primaryPreKeyBundle.identityKey = Buffer.from(
              primaryPreKeyBundle.identityKey,
              "base64"
            ).buffer;
            primaryPreKeyBundle.signedPreKey.publicKey = Buffer.from(
              primaryPreKeyBundle.signedPreKey.publicKey,
              "base64"
            ).buffer;
            primaryPreKeyBundle.signedPreKey.signature = Buffer.from(
              primaryPreKeyBundle.signedPreKey.signature,
              "base64"
            ).buffer;
            primaryPreKeyBundle.preKey.publicKey = Buffer.from(
              primaryPreKeyBundle.preKey.publicKey,
              "base64"
            ).buffer;
            console.log(primaryPreKeyBundle);
            // Save primary device identity in signalStore
            primarySignalStore.put(
              "identityKey",
              primaryPreKeyBundle.identityKey
            );

            // Functions
            const generateIdentity = async () => {
              const result = await Promise.all([
                window.libsignal.KeyHelper.generateIdentityKeyPair(),
                window.libsignal.KeyHelper.generateRegistrationId(),
              ]);
              return result;
            };

            // Create necessary compaion related data
            // Signal Protocol Address
            const companionSignalProtocolAddress =
              new window.libsignal.SignalProtocolAddress(
                receivedMessage.primaryUsername,
                2
              );
            // identityKeyPair and registrationId
            const [companionIdentityKeyPair, companionRegistrationId] =
              await generateIdentity();
            // preKeyId and preKeyPair
            const companionPreKey =
              await window.libsignal.KeyHelper.generatePreKey(
                Math.ceil(Math.random() * 100000)
              );
            console.log(companionPreKey);
            const companionSignedPreKey =
              await window.libsignal.KeyHelper.generateSignedPreKey(
                companionIdentityKeyPair,
                Math.ceil(Math.random() * 100000)
              );
            console.log(companionSignedPreKey);
            // Save companion related data to signalStore
            companionSignalStore.put("identityKey", companionIdentityKeyPair);
            companionSignalStore.put("registrationId", companionRegistrationId);
            await companionSignalStore.storePreKey(
              companionPreKey.keyId,
              companionPreKey.keyPair
            );
            await companionSignalStore.storeSignedPreKey(
              companionSignedPreKey.keyId,
              companionSignedPreKey.keyPair
            );
            console.log(companionSignalStore);

            const sessionBuilder = new window.libsignal.SessionBuilder(
              companionSignalStore,
              primarySignalProtocolAddress
            );
            const sessionPromise =
              sessionBuilder.processPreKey(primaryPreKeyBundle);

            sessionPromise.then(() => {
              console.log("Sending initial message to primary...");
              const companionSessionCipher = new window.libsignal.SessionCipher(
                companionSignalStore,
                primarySignalProtocolAddress
              );

              let plaintextMessage = Buffer.from(
                "Filename: test.txt\nContent: Hello World!",
                "utf-8"
              ).buffer;
              companionSessionCipher
                .encrypt(plaintextMessage)
                .then((ciphertext) => {
                  const preKeyWhisperMessageToSend = {
                    type: "preKeyWhisperMessage",
                    preKeyWhisperMessage: ciphertext,
                  };
                  // Save address and store to localStorage
                  localStorage.setItem(
                    "primarySignalProtocolAddress",
                    primarySignalProtocolAddress.toString()
                  );
                  localStorage.setItem(
                    "companionSignalStore",
                    JSON.stringify(companionSignalStore)
                  );
                  socket.send(JSON.stringify(preKeyWhisperMessageToSend));
                })
                .catch((err) => {
                  console.log("Error encrypting message");
                  console.log(err);
                });
            });

            sessionPromise.catch((err) => {
              console.log("Session Promise Rejected");
              console.log(err);
            });
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
