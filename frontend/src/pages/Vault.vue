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

        console.log(result);
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
            console.log("Generating IdentityKey", receivedMessage.preKeyBundle);
            const identityKey =
              await window.libsignal.KeyHelper.generateIdentityKey();
            console.log("IdentityKey", identityKey);
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
