<template>
  <div
    class="mb-[15px] min-h-8 flex gap-3 flex-wrap justify-between items-center w-full px-5 md:px-0">
    <Breadcrumbs v-if="breadcrumbs" :breadcrumbLinks="breadcrumbs" />
    <div class="flex gap-3 basis-full lg:basis-auto">
      <Dropdown
        v-if="actionItems.length > 0"
        :options="actionItems"
        placement="left"
        class="basis-5/12 lg:basis-auto">
        <Button
          class="text-sm h-8 w-full"
          iconRight="chevron-down"
          :loading="actionLoading">
          <span class="hidden md:inline">Actions</span>
        </Button>
      </Dropdown>
      <Dropdown
        v-if="columnHeaders"
        :options="orderByItems"
        placement="right"
        class="basis-5/12 lg:basis-auto">
        <div class="flex items-center whitespace-nowrap">
          <Button
            class="text-sm h-8 px-2 border-r border-slate-200 rounded-r-none"
            @click.stop="toggleAscending">
            <svg
              class="h-4 w-4 stroke-current inline-block"
              xmlns="http://www.w3.org/2000/svg">
              <path
                :d="
                  ascending
                    ? 'M1.75 3.25h9m-9 4h6m-6 4h4m8.5-3.5l-2-2-2 2m2 4v-6'
                    : 'M1.75 3.25h9m-9 4h6m-6 4h4m4.5-.5l2 2 2-2m-2 1v-6'
                "
                stroke-miterlimit="10"
                stroke-linecap="round"
                stroke-linejoin="round"></path>
            </svg>
          </Button>
          <Button class="text-sm h-8 rounded-l-none flex-1 hidden md:block">
            Sort by {{ orderByLabel.toLowerCase() }}
          </Button>
          <Button class="text-sm h-8 rounded-l-none flex-1 md:hidden">
            {{ orderByLabel }}
          </Button>
        </div>
      </Dropdown>
      <Button
        v-if="showInfoButton"
        icon="info"
        class="h-8 hidden md:block"
        @click="$store.commit('setShowInfo', true)"></Button>
      <div class="bg-gray-100 rounded-md p-0.5 space-x-0.5 h-8 flex">
        <Button
          icon="grid"
          class="h-7"
          @click="$store.commit('toggleView', 'grid')"
          :style="[
            $store.state.view === 'grid' && { background: '#FFF' },
          ]"></Button>
        <Button
          icon="list"
          class="h-7"
          @click="$store.commit('toggleView', 'list')"
          :style="[
            $store.state.view === 'list' && { background: '#FFF' },
          ]"></Button>
      </div>
    </div>
  </div>
</template>

<script>
import { Button, Dropdown } from "frappe-ui";
import Breadcrumbs from "@/components/Breadcrumbs.vue";

export default {
  name: "DriveToolBar",
  components: {
    Button,
    Breadcrumbs,
    Dropdown,
  },
  props: {
    breadcrumbs: {
      type: Array,
    },
    actionItems: {
      type: Array,
    },
    columnHeaders: {
      type: Array,
    },
    showInfoButton: {
      type: Boolean,
      default: false,
    },
    actionLoading: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    orderByField() {
      return this.$store.state.sortOrder.field;
    },
    orderByLabel() {
      return this.$store.state.sortOrder.label;
    },
    ascending() {
      return this.$store.state.sortOrder.ascending;
    },
    orderByItems() {
      return this.columnHeaders.map((header) => ({
        ...header,
        handler: () => {
          this.$store.commit("setSortOrder", {
            field: header.field,
            label: header.label,
            ascending: this.ascending,
          });
        },
      }));
    },
  },
  methods: {
    toggleAscending() {
      this.$store.commit("setSortOrder", {
        field: this.orderByField,
        label: this.orderByLabel,
        ascending: !this.ascending,
      });
    },
  },
  mounted() {
    for (let element of this.$el.getElementsByTagName("button")) {
      element.classList.remove("focus:ring-2", "focus:ring-offset-2");
    }
  },
};
</script>
