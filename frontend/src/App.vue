<template>
  <div
    @contextmenu.prevent="handleDefaultContext($event)"
    class="flex text-gray-900 h-screen antialiased overflow-y-hidden">
    <UploadTracker v-if="showUploadTracker" />
    <div
      class="h-full max-h-full w-full max-w-full flex flex-col"
      :class="{ 'sm:bg-gray-50': $route.meta.isPublicRoute }">
      <Navbar
        v-if="isLoggedIn && !isHybridRoute"
        :mobileSidebarIsOpen="showMobileSidebar"
        @toggleMobileSidebar="showMobileSidebar = !showMobileSidebar" />
      <div
        v-if="isLoggedIn && !isHybridRoute"
        class="flex h-full overflow-x-hidden">
        <MobileSidebar v-model="showMobileSidebar" />
        <div class="px-3 border-r hidden md:py-4 md:block">
          <Sidebar />
        </div>
        <div
          class="flex-1 overflow-y-auto overflow-x-hidden md:my-[25px] md:px-6">
          <router-view />
        </div>
        <Transition
          enter-from-class="translate-x-[150%] opacity-0"
          leave-to-class="translate-x-[150%] opacity-0"
          enter-active-class="transition duration-700"
          leave-active-class="transition duration-700">
          <div v-if="showInfoSidebar" class="border-l md:pt-6 flex">
            <InfoSidebar :entity="$store.state.entityInfo" />
          </div>
        </Transition>
      </div>
      <router-view v-else />
    </div>
  </div>
</template>
<script>
import Navbar from "@/components/Navbar.vue";
import Sidebar from "@/components/Sidebar.vue";
import InfoSidebar from "@/components/InfoSidebar.vue";
import MobileSidebar from "@/components/MobileSidebar.vue";
import UploadTracker from "@/components/UploadTracker.vue";

export default {
  name: "App",
  components: {
    Navbar,
    Sidebar,
    InfoSidebar,
    MobileSidebar,
    UploadTracker,
  },
  data() {
    return {
      showMobileSidebar: false,
    };
  },
  computed: {
    isLoggedIn() {
      return this.$store.getters.isLoggedIn;
    },
    isHybridRoute() {
      return this.$route.meta.isHybridRoute;
    },
    showUploadTracker() {
      return this.isLoggedIn && this.$store.state.uploads.length > 0;
    },
    showInfoSidebar() {
      return this.$store.state.showInfo && this.$store.state.entityInfo;
    },
  },
  watch: {
    $route() {
      this.$store.commit("setEntityInfo", null);
      this.$store.commit("setShowInfo", false);
    },
  },
  methods: {
    handleDefaultContext(event) {
      event.preventDefault();
    },
  },
};
</script>

<style>
html {
  -webkit-user-select: none; /* Safari */
  -ms-user-select: none; /* IE 10 and IE 11 */
  user-select: none; /* Standard syntax */
}
</style>
