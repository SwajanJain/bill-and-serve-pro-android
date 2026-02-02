import { Area, Category, MenuItem, Table, User, RestaurantSettings } from '@/types';

export const mockUsers: User[] = [
  { id: '1', name: 'Owner', email: 'owner@restro.com', phone: '9876543210', pin: '1234', role: 'owner', isActive: true, forcePasswordChange: true, createdAt: new Date() },
];

export const mockAreas: Area[] = [];

export const mockTables: Table[] = [];

// --- M2 Restaurant Full Menu (24 categories, ~130 items) ---

export const mockCategories: Category[] = [
  { id: 'cat_coffee', name: 'Coffee', sortOrder: 0, isActive: true },
  { id: 'cat_shakes', name: 'Shakes', sortOrder: 1, isActive: true },
  { id: 'cat_mojitos', name: 'Mojitos', sortOrder: 2, isActive: true },
  { id: 'cat_lassi', name: 'Kanha Ki Lassi', sortOrder: 3, isActive: true },
  { id: 'cat_salad', name: 'Salad', sortOrder: 4, isActive: true },
  { id: 'cat_papad', name: 'Papad', sortOrder: 5, isActive: true },
  { id: 'cat_soup', name: 'Soup', sortOrder: 6, isActive: true },
  { id: 'cat_daal', name: 'Daal', sortOrder: 7, isActive: true },
  { id: 'cat_sabzi', name: 'Seasonal Sabzi', sortOrder: 8, isActive: true },
  { id: 'cat_paneer', name: 'Paneer', sortOrder: 9, isActive: true },
  { id: 'cat_rice', name: 'Rice', sortOrder: 10, isActive: true },
  { id: 'cat_raita', name: 'Raita', sortOrder: 11, isActive: true },
  { id: 'cat_roti', name: 'Roti', sortOrder: 12, isActive: true },
  { id: 'cat_paratha', name: 'Paratha', sortOrder: 13, isActive: true },
  { id: 'cat_fries', name: 'French Fries', sortOrder: 14, isActive: true },
  { id: 'cat_burger', name: 'Burger', sortOrder: 15, isActive: true },
  { id: 'cat_sandwich', name: 'Sandwich', sortOrder: 16, isActive: true },
  { id: 'cat_pizza', name: 'Pizza', sortOrder: 17, isActive: true },
  { id: 'cat_chinese', name: 'Chinese', sortOrder: 18, isActive: true },
  { id: 'cat_pasta', name: 'Pasta', sortOrder: 19, isActive: true },
  { id: 'cat_brownie', name: 'Brownie', sortOrder: 20, isActive: true },
  { id: 'cat_snacks', name: 'Snacks', sortOrder: 21, isActive: true },
  { id: 'cat_sweets', name: 'Sweets', sortOrder: 22, isActive: true },
  { id: 'cat_thali', name: 'Thali', sortOrder: 23, isActive: true },
  { id: 'cat_beverages', name: 'Beverages', sortOrder: 24, isActive: true },
];

export const mockMenuItems: MenuItem[] = [
  // Coffee (4 items)
  { id: 'item_coffee_1', categoryId: 'cat_coffee', name: 'Hot Coffee', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_coffee_2', categoryId: 'cat_coffee', name: 'Cappuccino', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_coffee_3', categoryId: 'cat_coffee', name: 'Plain Cold Coffee', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_coffee_4', categoryId: 'cat_coffee', name: 'Cold Coffee with Ice Cream', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },

  // Shakes (5 items)
  { id: 'item_shakes_1', categoryId: 'cat_shakes', name: 'Oreo Shake', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_shakes_2', categoryId: 'cat_shakes', name: 'KitKat Shake', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_shakes_3', categoryId: 'cat_shakes', name: 'Chocolate Shake', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_shakes_4', categoryId: 'cat_shakes', name: 'Strawberry Shake', basePrice: 170, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_shakes_5', categoryId: 'cat_shakes', name: 'Choco Shake', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true },

  // Mojitos (4 items)
  { id: 'item_mojitos_1', categoryId: 'cat_mojitos', name: 'Lemon Mojito', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_mojitos_2', categoryId: 'cat_mojitos', name: 'Mint Mojito', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_mojitos_3', categoryId: 'cat_mojitos', name: 'Blueberry Mojito', basePrice: 130, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_mojitos_4', categoryId: 'cat_mojitos', name: 'Strawberry Mojito', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },

  // Kanha Ki Lassi (3 items)
  { id: 'item_lassi_1', categoryId: 'cat_lassi', name: 'Masala Chaach', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_lassi_2', categoryId: 'cat_lassi', name: 'Plain Lassi', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_lassi_3', categoryId: 'cat_lassi', name: 'Dry Fruit Lassi', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },

  // Salad (3 items)
  { id: 'item_salad_1', categoryId: 'cat_salad', name: 'Onion Salad', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_salad_2', categoryId: 'cat_salad', name: 'Green Salad', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_salad_3', categoryId: 'cat_salad', name: 'Kachumber Salad', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true },

  // Papad (3 items)
  { id: 'item_papad_1', categoryId: 'cat_papad', name: 'Plain Roasted Papad', basePrice: 20, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_papad_2', categoryId: 'cat_papad', name: 'Fried Papad', basePrice: 30, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_papad_3', categoryId: 'cat_papad', name: 'Masala Papad', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true },

  // Soup (4 items)
  { id: 'item_soup_1', categoryId: 'cat_soup', name: 'Tomato Soup', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_soup_2', categoryId: 'cat_soup', name: 'Sweet Corn Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_soup_3', categoryId: 'cat_soup', name: 'Manchow Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_soup_4', categoryId: 'cat_soup', name: 'Hot & Sour Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },

  // Daal (4 items)
  { id: 'item_daal_1', categoryId: 'cat_daal', name: 'Fried Daal', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_daal_2', categoryId: 'cat_daal', name: 'Daal Tadka', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_daal_3', categoryId: 'cat_daal', name: 'Daal Masala', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_daal_4', categoryId: 'cat_daal', name: 'Daal Butter', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true },

  // Seasonal Sabzi (11 items — menu says 10 listed but counting: Mix Veg, Sev Tamatar, Sev Bhaaji, Muttur Masala, Chana Masala, Aloo Masala, Aloo Jeera, Baingan Masala, Tamatar Masala, Bhindi Masala = 10)
  { id: 'item_sabzi_1', categoryId: 'cat_sabzi', name: 'Mix Veg', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_2', categoryId: 'cat_sabzi', name: 'Sev Tamatar', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_3', categoryId: 'cat_sabzi', name: 'Sev Bhaaji', basePrice: 170, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_4', categoryId: 'cat_sabzi', name: 'Muttur Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_5', categoryId: 'cat_sabzi', name: 'Chana Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_6', categoryId: 'cat_sabzi', name: 'Aloo Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_7', categoryId: 'cat_sabzi', name: 'Aloo Jeera', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_8', categoryId: 'cat_sabzi', name: 'Baingan Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_9', categoryId: 'cat_sabzi', name: 'Tamatar Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sabzi_10', categoryId: 'cat_sabzi', name: 'Bhindi Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true },

  // Paneer (21 items)
  { id: 'item_paneer_1', categoryId: 'cat_paneer', name: 'Matar Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_2', categoryId: 'cat_paneer', name: 'Chola Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_3', categoryId: 'cat_paneer', name: 'Palak Paneer', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_4', categoryId: 'cat_paneer', name: 'Kaju Kari', basePrice: 210, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_5', categoryId: 'cat_paneer', name: 'Kadai Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_6', categoryId: 'cat_paneer', name: 'Masala Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_7', categoryId: 'cat_paneer', name: 'Malai Kofta', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_8', categoryId: 'cat_paneer', name: 'Shahi Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_9', categoryId: 'cat_paneer', name: 'Paneer Do Pyaza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_10', categoryId: 'cat_paneer', name: 'Butter Paneer Masala', basePrice: 240, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_11', categoryId: 'cat_paneer', name: 'Hyderabadi Paneer', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_12', categoryId: 'cat_paneer', name: 'Kaju Paneer', basePrice: 240, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_13', categoryId: 'cat_paneer', name: 'Paneer Kofta', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_14', categoryId: 'cat_paneer', name: 'Paneer Kolhapuri', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_15', categoryId: 'cat_paneer', name: 'Paneer Angaara', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_16', categoryId: 'cat_paneer', name: 'Paneer Lababdaar', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_17', categoryId: 'cat_paneer', name: 'Punjabi Paneer', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_18', categoryId: 'cat_paneer', name: 'Paneer Handi', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_19', categoryId: 'cat_paneer', name: 'Paneer Bhurji', basePrice: 270, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_20', categoryId: 'cat_paneer', name: 'Paneer Tikka Masala', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paneer_21', categoryId: 'cat_paneer', name: 'M2 Special Paneer', basePrice: 350, taxRatePercent: 5, isVeg: true, isActive: true },

  // Rice (7 items)
  { id: 'item_rice_1', categoryId: 'cat_rice', name: 'Jeera Rice', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_2', categoryId: 'cat_rice', name: 'Masala Rice', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_3', categoryId: 'cat_rice', name: 'Muttur Pulao', basePrice: 130, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_4', categoryId: 'cat_rice', name: 'Aloo Pulao', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_5', categoryId: 'cat_rice', name: 'Veg Pulao', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_6', categoryId: 'cat_rice', name: 'Kaju Paneer Pulao', basePrice: 190, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_rice_7', categoryId: 'cat_rice', name: 'Hyderabadi Veg Biryani', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true },

  // Raita (3 items)
  { id: 'item_raita_1', categoryId: 'cat_raita', name: 'Bundi Raita', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_raita_2', categoryId: 'cat_raita', name: 'Vegetable Raita', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_raita_3', categoryId: 'cat_raita', name: 'Mint Raita', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },

  // Roti (7 items)
  { id: 'item_roti_1', categoryId: 'cat_roti', name: 'Tawa Roti', basePrice: 10, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_2', categoryId: 'cat_roti', name: 'Tawa Butter Roti', basePrice: 12, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_3', categoryId: 'cat_roti', name: 'Tandoori Roti', basePrice: 10, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_4', categoryId: 'cat_roti', name: 'Tandoori Butter Roti', basePrice: 12, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_5', categoryId: 'cat_roti', name: 'Plain Naan', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_6', categoryId: 'cat_roti', name: 'Butter Naan', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_roti_7', categoryId: 'cat_roti', name: 'Garlic Naan', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },

  // Paratha (6 items)
  { id: 'item_paratha_1', categoryId: 'cat_paratha', name: 'Laccha Paratha', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paratha_2', categoryId: 'cat_paratha', name: 'Aloo Paratha', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paratha_3', categoryId: 'cat_paratha', name: 'Sev Paratha', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paratha_4', categoryId: 'cat_paratha', name: 'Masala Paratha', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paratha_5', categoryId: 'cat_paratha', name: 'Paneer Paratha', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_paratha_6', categoryId: 'cat_paratha', name: 'M2 Special Paratha', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },

  // French Fries (4 items)
  { id: 'item_fries_1', categoryId: 'cat_fries', name: 'Plain French Fries', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_fries_2', categoryId: 'cat_fries', name: 'Masala French Fries', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_fries_3', categoryId: 'cat_fries', name: 'Cheese French Fries', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_fries_4', categoryId: 'cat_fries', name: 'Peri Peri French Fries', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },

  // Burger (3 items)
  { id: 'item_burger_1', categoryId: 'cat_burger', name: 'Veg Cheese Burger', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_burger_2', categoryId: 'cat_burger', name: 'Paneer Cheese Burger', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_burger_3', categoryId: 'cat_burger', name: 'Double Cheese Burger', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true },

  // Sandwich (6 items)
  { id: 'item_sandwich_1', categoryId: 'cat_sandwich', name: 'Veg Sandwich', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sandwich_2', categoryId: 'cat_sandwich', name: 'Veg Cheese Sandwich', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sandwich_3', categoryId: 'cat_sandwich', name: 'Cheese Corn Sandwich', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sandwich_4', categoryId: 'cat_sandwich', name: 'Peri Peri Cheese Sandwich', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sandwich_5', categoryId: 'cat_sandwich', name: 'Paneer Cheese Sandwich', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sandwich_6', categoryId: 'cat_sandwich', name: 'M2 Special Sandwich', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true },

  // Pizza (8 items)
  { id: 'item_pizza_1', categoryId: 'cat_pizza', name: 'Onion Pizza', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_2', categoryId: 'cat_pizza', name: 'Margherita Pizza', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_3', categoryId: 'cat_pizza', name: 'Capsicum Pizza', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_4', categoryId: 'cat_pizza', name: 'Classic Veggie Pizza', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_5', categoryId: 'cat_pizza', name: 'Cheese Corn Delight Pizza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_6', categoryId: 'cat_pizza', name: 'Peri Peri Paneer Pizza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_7', categoryId: 'cat_pizza', name: 'Paneer Tikka Pizza', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pizza_8', categoryId: 'cat_pizza', name: 'M2 Special Delight Pizza', basePrice: 420, taxRatePercent: 5, isVeg: true, isActive: true },

  // Chinese (9 items)
  { id: 'item_chinese_1', categoryId: 'cat_chinese', name: 'Veg Noodles', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_2', categoryId: 'cat_chinese', name: 'Hakka Noodles', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_3', categoryId: 'cat_chinese', name: 'Veg Manchurian Mix Noodles', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_4', categoryId: 'cat_chinese', name: 'Veg Kothey', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_5', categoryId: 'cat_chinese', name: 'Gravy Manchurian', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_6', categoryId: 'cat_chinese', name: 'Dry Manchurian', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_7', categoryId: 'cat_chinese', name: 'Schezwan Fried Rice', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_8', categoryId: 'cat_chinese', name: 'Chilli Potato', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_chinese_9', categoryId: 'cat_chinese', name: 'Chilli Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },

  // Pasta (3 items)
  { id: 'item_pasta_1', categoryId: 'cat_pasta', name: 'Veg Pasta', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pasta_2', categoryId: 'cat_pasta', name: 'Red Sauce Pasta', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_pasta_3', categoryId: 'cat_pasta', name: 'White Sauce Pasta', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },

  // Brownie (3 items)
  { id: 'item_brownie_1', categoryId: 'cat_brownie', name: 'Brownie with Ice Cream', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_brownie_2', categoryId: 'cat_brownie', name: 'Oreo Brownie', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_brownie_3', categoryId: 'cat_brownie', name: 'M2 Special Brownie', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true },

  // Snacks (13 items)
  { id: 'item_snacks_1', categoryId: 'cat_snacks', name: 'Chole Bhatura', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_2', categoryId: 'cat_snacks', name: 'Chole Kulcha', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_3', categoryId: 'cat_snacks', name: 'Pav Bhaji', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_4', categoryId: 'cat_snacks', name: 'Crispy Corn', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_5', categoryId: 'cat_snacks', name: 'Steam Momos', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_6', categoryId: 'cat_snacks', name: 'Fried Momos', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_7', categoryId: 'cat_snacks', name: 'Paneer Momos', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_8', categoryId: 'cat_snacks', name: 'Paneer Pakoda', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_9', categoryId: 'cat_snacks', name: 'Paneer Tikka', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_10', categoryId: 'cat_snacks', name: 'Achari Paneer Tikka', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_11', categoryId: 'cat_snacks', name: 'Malai Paneer Tikka', basePrice: 260, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_12', categoryId: 'cat_snacks', name: 'Chana Roast', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_snacks_13', categoryId: 'cat_snacks', name: 'Peanut Masala', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true },

  // Sweets (2 items)
  { id: 'item_sweets_1', categoryId: 'cat_sweets', name: 'Gulab Jamun (2 pcs)', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_sweets_2', categoryId: 'cat_sweets', name: 'White Rasgulla (2 pcs)', basePrice: 30, taxRatePercent: 5, isVeg: true, isActive: true },

  // Thali (4 items)
  { id: 'item_thali_1', categoryId: 'cat_thali', name: 'Special Thali', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_thali_2', categoryId: 'cat_thali', name: 'Deluxe Thali', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_thali_3', categoryId: 'cat_thali', name: 'Super Deluxe Thali', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_thali_4', categoryId: 'cat_thali', name: 'M2 Special Thali', basePrice: 350, taxRatePercent: 5, isVeg: true, isActive: true },

  // Beverages (2 items)
  { id: 'item_beverages_1', categoryId: 'cat_beverages', name: 'Water Bottle (Small)', basePrice: 10, taxRatePercent: 5, isVeg: true, isActive: true },
  { id: 'item_beverages_2', categoryId: 'cat_beverages', name: 'Water Bottle (Large)', basePrice: 20, taxRatePercent: 5, isVeg: true, isActive: true },
];

export const defaultSettings: RestaurantSettings = {
  name: 'M2 Restaurant',
  phone: '',
  address: 'Ganjbasoda, Madhya Pradesh',
  gstEnabled: false,
  gstin: '',
  defaultTaxRate: 5,
  showTaxBreakdown: true,
  cashierDiscountLimit: 10,
  requireCancelReason: true,
  closingTime: '23:00',
};

// Generate order number
export const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${dateStr}-${random}`;
};
