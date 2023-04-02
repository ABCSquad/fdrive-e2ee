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
import { uuid } from "vue-uuid";
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
    async generateQR() {
      try {
        const res = await fetch(
          `http://192.168.29.215:5000/api/session/initiate`,
          {
            method: "GET",
            headers: {
              Connection: "Upgrade",
              Upgrade: "websocket",
              "Sec-WebSocket-Version": 13,
              "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            },
          }
        );

        if (!res.ok) {
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

        this.token = result.data.data;

        // Connect to websocket connection
        const socket = new WebSocket(
          `ws://192.168.29.215:5000/companion/${this.token}`
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
            // Create a new signalStore
            const signalStore = new SignalProtocolStore();

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

            // Save primary device identity in signalStore
            signalStore.saveIdentity(
              primarySignalProtocolAddress.toString(),
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
            const signalProtocolAddress =
              new window.libsignal.SignalProtocolAddress(
                receivedMessage.primaryUsername,
                uuid.v4().toString()
              );
            // identityKeyPair and registrationId
            const [identityKeyPair, registrationId] = await generateIdentity();
            // preKey
            const preKeyId = Math.ceil(Math.random() * 100000);
            const preKey = await window.libsignal.KeyHelper.generatePreKey(
              preKeyId
            );
            // signedPreKey
            const signedPreKey =
              await window.libsignal.KeyHelper.generateSignedPreKey(
                identityKeyPair,
                registrationId
              );

            // Save companion related data to signalStore
            signalStore.saveIdentity(
              signalProtocolAddress.toString(),
              identityKeyPair.pubKey
            );
            signalStore.storePreKey(preKey.keyId, preKey);
            signalStore.storeSignedPreKey(signedPreKey.keyId, signedPreKey);

            const sessionBuilder = new window.libsignal.SessionBuilder(
              signalStore,
              primarySignalProtocolAddress
            );
            const sessionPromise =
              sessionBuilder.processPreKey(primaryPreKeyBundle);

            sessionPromise.then(() => {
              console.log("Sending initial message to primary...");
              const sessionCipher = new window.libsignal.SessionCipher(
                signalStore,
                primarySignalProtocolAddress
              );
              let plaintextMessage = new TextEncoder().encode(
                "Hey there, primary!"
              ).buffer;
              sessionCipher
                .encrypt(plaintextMessage)
                .then((ciphertext) => {
                  const preKeyWhisperMessageToSend = {
                    type: "preKeyWhisperMessage",
                    preKeyWhisperMessage: ciphertext,
                  };
                  console.log(ciphertext);
                  // Creating store for bob
                  const bobSignalStore = new SignalProtocolStore();
                  // Saving identity
                  bobSignalStore.saveIdentity(
                    primarySignalProtocolAddress.toString(),
                    primaryPreKeyBundle.identityKey
                  );
                  // Create receiver sessionCipher
                  const bobSessionCipher = new window.libsignal.SessionCipher(
                    bobSignalStore,
                    signalProtocolAddress
                  );
                  // Decrypting to test
                  bobSessionCipher
                    .decryptPreKeyWhisperMessage(ciphertext.body, "binary")
                    .then((plaintext) => {
                      console.log("Decrypted message: ", plaintext);
                    })
                    .catch((err) => {
                      console.log("Error decrypting message");
                      console.log(err);
                    });
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
