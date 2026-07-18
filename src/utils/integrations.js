/**
 * Frontend Integration Registry
 *
 * One source of truth for every integration.
 * Mirrors backend/integrations/registry.js
 */

export default {

  xero: {

    id: "xero",

    label: "Xero",

    category: "Accounting",

    requiresOAuth: true,

    supportsExport: true,

    icon: "xero"

  },

  quickbooks: {

    id: "quickbooks",

    label: "QuickBooks",

    category: "Accounting",

    requiresOAuth: true,

    supportsExport: true,

    icon: "quickbooks"

  },

  "google-drive": {

    id: "google_drive",

    label: "Google Drive",

    category: "Storage",

    requiresOAuth: true,

    supportsExport: true,

    icon: "google-drive"

  },

  dropbox: {

    id: "dropbox",

    label: "Dropbox",

    category: "Storage",

    requiresOAuth: true,

    supportsExport: true,

    icon: "dropbox"

  },

  onedrive: {

    id: "onedrive",

    label: "OneDrive",

    category: "Storage",

    requiresOAuth: true,

    supportsExport: true,

    icon: "onedrive"

  },


  slack: {

    id: "slack",

    label: "Slack",

    category: "Messaging",

    requiresOAuth: false,

    supportsExport: true,

    icon: "slack"

  },

  webhook: {

    id: "webhook",

    label: "Webhook",

    category: "Automation",

    requiresOAuth: false,

    supportsExport: true,

    icon: "webhook"

  }

};