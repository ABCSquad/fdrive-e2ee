<template>
  <div class="h-full w-full">
    <pre>{{ $resources.posts }}</pre>
    <div class="h-full flex flex-col justify-center items-center">
      <Button @click="$resources.genrateQR()">Click to generate QR</Button>
    </div>
  </div> 
</template>

<script>
import { computeStyles } from '@popperjs/core';
import { Button } from 'frappe-ui';



export default {
    name: "Vault",
    resources: {
       genrateQR() {
        return {
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: "GET",
      }
        }
    },
    components: { Button }
};
</script>
