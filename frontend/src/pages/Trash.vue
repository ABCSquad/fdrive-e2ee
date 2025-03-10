<template>
  <div class="h-full">
    <FolderContentsError
      v-if="$resources.folderContents.error"
      :error="$resources.folderContents.error" />

    <GridView
      v-else-if="$store.state.view === 'grid'"
      :folderContents="$resources.folderContents.data"
      :selectedEntities="selectedEntities"
      @entitySelected="(selected) => (selectedEntities = selected)"
      @showEntityContext="(event) => toggleEntityContext(event)"
      @closeContextMenuEvent="closeContextMenu">
      <template #toolbar>
        <DriveToolBar
          :actionItems="actionItems"
          :breadcrumbs="breadcrumbs"
          :columnHeaders="columnHeaders"
          :actionLoading="actionLoading"
          :showUploadButton="false" />
      </template>
      <template #placeholder>
        <NoFilesSection
          :primaryMessage="'Trash is currently empty'"
          :secondaryMessage="'Items in the trash will be deleted automatically after 30 days'" />
      </template>
    </GridView>

    <ListView
      v-else
      :folderContents="$resources.folderContents.data"
      :selectedEntities="selectedEntities"
      @entitySelected="(selected) => (selectedEntities = selected)"
      @showEntityContext="(event) => toggleEntityContext(event)"
      @closeContextMenuEvent="closeContextMenu">
      <template #toolbar>
        <DriveToolBar
          :actionItems="actionItems"
          :breadcrumbs="breadcrumbs"
          :columnHeaders="columnHeaders"
          :actionLoading="actionLoading"
          :showUploadButton="false" />
      </template>
      <template #placeholder>
        <NoFilesSection
          :primaryMessage="'Trash is currently empty'"
          :secondaryMessage="'Items in the trash will be deleted automatically after 30 days'" />
      </template>
    </ListView>
    <EntityContextMenu
      v-if="showEntityContext"
      :actionItems="actionItems"
      :entityContext="entityContext"
      :close="closeContextMenu"
      v-on-outside-click="closeContextMenu" />
    <DeleteDialog
      v-model="showDeleteDialog"
      :entities="
        selectedEntities.length > 0
          ? selectedEntities
          : $resources.folderContents.data
      "
      @success="
        () => {
          $resources.folderContents.fetch();
          showDeleteDialog = false;
          selectedEntities = [];
        }
      " />
    <GeneralDialog
      v-model="showRestoreDialog"
      :entities="selectedEntities"
      :for="'restore'"
      @success="
        () => {
          $resources.folderContents.fetch();
          showRestoreDialog = false;
          selectedEntities = [];
        }
      " />
    <div />
  </div>
</template>

<script>
import DriveToolBar from "@/components/DriveToolBar.vue";
import FolderContentsError from "@/components/FolderContentsError.vue";
import GridView from "@/components/GridView.vue";
import ListView from "@/components/ListView.vue";
import DeleteDialog from "@/components/DeleteDialog.vue";
import GeneralDialog from "@/components/GeneralDialog.vue";
import NoFilesSection from "@/components/NoFilesSection.vue";
import EntityContextMenu from "@/components/EntityContextMenu.vue";
import { formatDate, formatSize } from "@/utils/format";
import { FeatherIcon } from "frappe-ui";

export default {
  name: "Trash",
  components: {
    FeatherIcon,
    ListView,
    GridView,
    DriveToolBar,
    DeleteDialog,
    GeneralDialog,
    NoFilesSection,
    FolderContentsError,
    EntityContextMenu,
  },
  data: () => ({
    selectedEntities: [],
    breadcrumbs: [{ label: "Trash", route: "/trash" }],
    actionLoading: false,
    showDeleteDialog: false,
    showRestoreDialog: false,
    showEntityContext: false,
    entityContext: {},
  }),
  computed: {
    userId() {
      return this.$store.state.auth.user_id;
    },
    orderBy() {
      return this.$store.state.sortOrder.ascending
        ? this.$store.state.sortOrder.field
        : `${this.$store.state.sortOrder.field} desc`;
    },
    actionItems() {
      return [
        {
          label: "Empty Trash",
          icon: "trash-2",
          handler: () => {
            this.showDeleteDialog = true;
          },
          isEnabled: () => {
            return (
              this.selectedEntities.length === 0 &&
              this.$resources.folderContents.data?.length > 0
            );
          },
        },
        {
          label: "Restore",
          icon: "refresh-ccw",
          handler: () => {
            this.showRestoreDialog = true;
          },
          isEnabled: () => {
            return this.selectedEntities.length > 0;
          },
        },
        {
          label: "Delete Forever",
          icon: "trash-2",
          handler: () => {
            this.showDeleteDialog = true;
          },
          isEnabled: () => {
            return this.selectedEntities.length > 0;
          },
        },
      ].filter((item) => item.isEnabled());
    },
    columnHeaders() {
      return [
        {
          label: "Name",
          field: "title",
          sortable: true,
        },
        {
          label: "Owner",
          field: "owner",
          sortable: true,
        },
        {
          label: "Modified",
          field: "modified",
          sortable: true,
        },
        {
          label: "Size",
          field: "file_size",
          sortable: true,
        },
      ].filter((item) => item.sortable);
    },
  },

  mounted() {
    window.addEventListener(
      "dragover",
      function (e) {
        e = e || event;
        e.preventDefault();
      },
      false
    );
    window.addEventListener(
      "drop",
      function (e) {
        e = e || event;
        e.preventDefault();
      },
      false
    );
  },
  methods: {
    toggleEntityContext(event) {
      if (!event) this.showEntityContext = false;
      else {
        this.showEntityContext = true;
        this.entityContext = event;
      }
    },
    closeContextMenu() {
      this.showEntityContext = false;
      this.entityContext = undefined;
    },
  },
  resources: {
    folderContents() {
      return {
        url: "drive.api.files.list_folder_contents",
        params: {
          order_by: this.orderBy,
          fields:
            "name,title,is_group,owner,modified,file_size,mime_type,creation",
          is_active: 0,
        },
        onSuccess(data) {
          this.$resources.folderContents.error = null;
          data.forEach((entity) => {
            entity.size_in_bytes = entity.file_size;
            entity.file_size = entity.is_group
              ? "-"
              : formatSize(entity.file_size);
            entity.modified = formatDate(entity.modified);
            entity.creation = formatDate(entity.creation);
            entity.owner = entity.owner === this.userId ? "me" : entity.owner;
          });
        },
        auto: true,
      };
    },
  },
};
</script>
