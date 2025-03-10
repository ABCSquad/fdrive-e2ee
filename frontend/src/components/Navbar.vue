<template>
  <nav class="bg-white border-b">
    <div
      class="mx-auto py-2 px-5 md:pl-3 h-16 md:h-12 z-10 flex justify-between">
      <div class="flex items-center">
        <router-link to="/" class="hidden md:block">
          <FrappeDriveLogo class="h-4" />
        </router-link>
        <div class="flex items-center md:hidden">
          <button
            class="mr-5 inline-flex items-center justify-center text-gray-700 rounded-md focus:outline-none focus:shadow-outline-gray"
            @click="$emit('toggleMobileSidebar')">
            <FeatherIcon
              v-if="!mobileSidebarIsOpen"
              name="menu"
              class="w-6 h-6" />
            <FeatherIcon v-else name="x" class="w-6 h-6" />
          </button>
          <router-link to="/">
            <FrappeLogo class="h-6 w-auto" />
          </router-link>
        </div>
      </div>
      <div class="relative ml-auto mt-2.5 md:mt-0.5 z-10">
        <SearchPopup @openEntity="(entity) => openEntity(entity)" />
      </div>
      <div class="flex items-center">
        <Dropdown
          :options="$store.state.hasWriteAccess ? addOptions : []"
          placement="left"
          class="basis-5/12 lg:basis-auto">
          <Button
            class="ml-4 md:ml-8 mr-5 h-8 w-8 rounded-full"
            appearance="primary"
            icon="plus"
            :disabled="!$store.state.hasWriteAccess"></Button>
        </Dropdown>
        <div class="border h-5"></div>
        <Button
          class="stroke-1.5 ml-4 md:ml-5"
          appearance="minimal"
          icon="bell"></Button>
        <div class="relative ml-3">
          <Dropdown :options="accountOptions" placement="right">
            <button
              class="flex items-center max-w-xs text-sm text-white rounded-full focus:outline-none focus:shadow-solid"
              id="user-menu"
              aria-label="User menu"
              aria-haspopup="true">
              <div class="flex items-center gap-4">
                <Avatar :label="fullName" :imageURL="imageURL" />
              </div>
            </button>
          </Dropdown>
        </div>
      </div>
    </div>
  </nav>
  <NewFolderDialog
    v-model="showNewFolderDialog"
    :parent="$route.params.entityName"
    @success="
      () => {
        this.emitter.emit('fetchFolderContents');
        showNewFolderDialog = false;
      }
    " />
  <FilePreview
    v-if="showPreview"
    @hide="hidePreview"
    :previewEntity="previewEntity" />
</template>
<script>
import { Avatar, Dropdown, FeatherIcon, Input, Button } from "frappe-ui";
import FrappeDriveLogo from "@/components/FrappeDriveLogo.vue";
import SearchPopup from "@/components/SearchPopup.vue";
import NewFolderDialog from "@/components/NewFolderDialog.vue";
import FilePreview from "@/components/FilePreview.vue";
import FrappeLogo from "@/components/FrappeLogo.vue";

export default {
  name: "Navbar",
  components: {
    FilePreview,
    FrappeDriveLogo,
    FrappeLogo,
    SearchPopup,
    NewFolderDialog,
    Avatar,
    Dropdown,
    FeatherIcon,
    Input,
    Button,
  },
  props: {
    mobileSidebarIsOpen: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["toggleMobileSidebar"],
  data() {
    return {
      previewEntity: null,
      showPreview: false,
      showNewFolderDialog: false,
      addOptions: [
        {
          label: "New folder",
          icon: "folder-plus",
          handler: () => (this.showNewFolderDialog = true),
        },
        {
          label: "Upload file",
          icon: "upload",
          handler: () => this.emitter.emit("uploadFile"),
        },
      ],
      accountOptions: [
        {
          label: "Log out",
          handler: () => this.$store.dispatch("logout"),
        },
      ],
      showSearchPopup: false,
    };
  },
  computed: {
    fullName() {
      return this.$store.state.user.fullName;
    },
    imageURL() {
      return this.$store.state.user.imageURL;
    },
  },
  methods: {
    openEntity(entity) {
      if (entity.is_group) {
        this.$router.push({
          name: "Folder",
          params: { entityName: entity.name },
        });
      } else {
        this.previewEntity = entity;
        this.showPreview = true;
      }
    },
    hidePreview() {
      this.showPreview = false;
      this.previewEntity = null;
    },
  },
};
</script>
