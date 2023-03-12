<template>
  <div class="h-full w-full">
    <div class="h-full flex flex-col justify-center items-center">
      <Button @click="generateQR()">Get Resource</Button>
      <pre>{{ token }}</pre>
    </div>
  </div>
</template>

<script>
import { Button } from "frappe-ui";

export default {
  name: "Vault",
  // eslint-disable-next-line vue/no-reserved-component-names
  components: { Button },
  data: () => ({
    token: null,
  }),
  methods: {
    async generateQR() {
      try {
        const res = await fetch(`http://localhost:5000/api/session/initiate`);

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
      } catch (err) {
        console.log(err.message);
      }
    },
  },
};
</script>
