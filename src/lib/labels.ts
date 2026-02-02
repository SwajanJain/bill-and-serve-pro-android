// Centralized UI labels (English)

export const L = {
  // App
  appName: 'Billit',

  // Login
  enterPin: 'Enter your PIN',
  invalidPin: 'Invalid PIN',
  loginFailed: 'Login failed',

  // POS
  newOrder: 'New Order',
  dineIn: 'Dine-In',
  takeaway: 'Takeaway',
  addItems: 'Add items',
  noItems: 'No items',
  searchMenu: 'Search...',
  viewCart: 'View Cart',
  items: 'items',

  // Order
  subtotal: 'Subtotal',
  discount: 'Discount',
  tax: 'GST',
  total: 'Total',
  orderNumber: 'Order #',

  // Payment
  collectPayment: 'Collect Payment',
  amountDue: 'Amount Due',
  paymentMethod: 'Payment Method',
  cash: 'Cash',
  upi: 'UPI',
  receivedAmount: 'Received Amount',
  change: 'Change',
  exact: 'Exact',
  complete: 'Complete',
  processing: 'Processing...',

  // Actions
  cancel: 'Cancel',
  save: 'Save',
  saveAll: 'Save All',
  delete: 'Delete',
  edit: 'Edit',
  add: 'Add',
  done: 'Done',
  skip: 'Skip',
  confirm: 'Confirm',
  logout: 'Logout',
  logoutConfirm: 'Are you sure you want to logout?',

  // Cancel order
  cancelOrder: 'Cancel Order?',
  cancelOrderDesc: 'This order will be removed. This cannot be undone.',
  keepOrder: 'Keep Order',
  yesCancelOrder: 'Yes, Cancel',

  // Item removal
  removeItem: 'Remove item?',
  removeItemDesc: 'Remove this item from order?',

  // Dashboard
  todaysSummary: 'Today\'s Summary',
  cashTotal: 'Cash Total',
  upiTotal: 'UPI Total',
  orderCount: 'Total Orders',
  noOrdersYet: 'No orders today',

  // Navigation
  pos: 'POS',
  tables: 'Tables',
  dashboard: 'Dashboard',
  menu: 'Menu',
  settings: 'Settings',
  more: 'More',

  // Tables
  available: 'Available',
  occupied: 'Occupied',
  inactive: 'Inactive',
  addArea: 'Add Area',
  addTable: 'Add Table',
  noAreas: 'No areas. Add your first area.',

  // Menu management
  menuManagement: 'Menu Management',
  addItem: 'Add Item',
  addCategory: 'Add Category',
  noMenuItems: 'No items. Add items to menu.',

  // Settings
  restaurantDetails: 'Restaurant Details',
  taxSettings: 'Tax Settings',
  userManagement: 'Staff Management',
  security: 'Security',
  closingTime: 'Closing Time',

  // Toasts (success)
  paymentComplete: 'Payment complete!',
  orderCancelled: 'Order cancelled',
  itemAdded: 'Item added',
  discountApplied: 'Discount applied',
  settingsSaved: 'Settings saved',
  userSaved: 'Staff updated',
  tableSaved: 'Table updated',
  areaSaved: 'Area updated',

  // Toasts (error)
  errorGeneric: 'Something went wrong',
  errorSaving: 'Error saving',
  errorCannotDelete: 'Cannot delete',
  errorDuplicatePin: 'This PIN is already in use',
  errorActiveOrder: 'Table has active order',
  errorItemInOrder: 'Item exists in active order',
  errorInvalidPhone: 'Enter 10-digit mobile number',
  errorNameRequired: 'Name is required',
  errorPhoneRequired: '10-digit phone required',
  errorTaxRange: 'Tax must be 0-28%',

  // Setup
  setupWelcome: 'Welcome to Bill & Serve Pro!',
  setupStep1: 'Restaurant Info',
  setupStep2: 'Tax & Timing',
  setupStep3: 'Areas & Tables',
  setupStep4: 'Menu',
  setupStep5: 'Change PIN',
  setupComplete: 'Setup complete!',
  next: 'Next',
  previous: 'Back',
  finishSetup: 'Finish Setup',
  changePinTitle: 'Change Default PIN',
  changePinDesc: 'Change PIN from 1234 for security',
  newPin: 'New PIN',
  confirmPin: 'Confirm PIN',
  pinMismatch: 'PINs do not match',

  // GST
  gstEnabled: 'Enable GST',
  gstEnabledDesc: 'Show GST on bills',
  gstDisabledHint: 'GST is off. Enable in Settings.',

  // Permission
  permissionDenied: 'You don\'t have permission for this page',

  // Post-payment
  orderComplete: 'Order complete!',
  orderSavedSuccess: 'Payment successful. Order saved.',

  // Free table
  freeTable: 'Free Table',
  freeTableConfirm: 'Free this table?',
  freeTableDesc: 'The order on this table will be cancelled.',
  tableFreed: 'Table freed',

  // CSV import
  importCsv: 'Import CSV',
  csvImported: 'CSV imported',
  csvError: 'Invalid CSV format',
  csvMissingColumns: 'CSV must have name, price, category columns',

  // Back button
  backExitHint: 'Press back again to exit',

  // PDF & Logo
  uploadLogo: 'Upload Logo',
  removeLogo: 'Remove Logo',
  shareBill: 'Share Bill',
  savePdf: 'Save PDF',
  pdfSaved: 'PDF saved',
  generatingPdf: 'Generating PDF...',
} as const;
