import arrowBack from "../assets/icons/arrow-back.png";
import arrowDown from "@/assets/icons/arrow-down.png";
import arrowRight from "@/assets/icons/arrow-right.png";
import bag from "@/assets/icons/bag.png";
import check from "@/assets/icons/check.png";
import clock from "@/assets/icons/clock.png";
import dollar from "@/assets/icons/dollar.png";
import envelope from "@/assets/icons/envelope.png";
import home from "@/assets/icons/home.png";
import location from "@/assets/icons/location.png";
import logout from "@/assets/icons/logout.png";
import minus from "@/assets/icons/minus.png";
import pencil from "@/assets/icons/pencil.png";
import person from "@/assets/icons/person.png";
import phone from "@/assets/icons/phone.png";
import plus from "@/assets/icons/plus.png";
import search from "@/assets/icons/search.png";
import star from "@/assets/icons/star.png";
import trash from "@/assets/icons/trash.png";
import user from "@/assets/icons/user.png";

import avatar from "@/assets/images/avatar.png";
import avocado from "@/assets/images/avocado.png";
import bacon from "@/assets/images/bacon.png";
import burgerOne from "@/assets/images/burger-one.png";
import burgerTwo from "@/assets/images/burger-two.png";
import buritto from "@/assets/images/buritto.png";
import cheese from "@/assets/images/cheese.png";
import coleslaw from "@/assets/images/coleslaw.png";
import cucumber from "@/assets/images/cucumber.png";
import emptyState from "@/assets/images/empty-state.png";
import fries from "@/assets/images/fries.png";
import loginGraphic from "@/assets/images/login-graphic.png";
import logo from "@/assets/images/logo.png";
import mozarellaSticks from "@/assets/images/mozarella-sticks.png";
import mushrooms from "@/assets/images/mushrooms.png";
import onionRings from "@/assets/images/onion-rings.png";
import onions from "@/assets/images/onions.png";
import pizzaOne from "@/assets/images/pizza-one.png";
import salad from "@/assets/images/salad.png";
import success from "@/assets/images/success.png";
import tomatoes from "@/assets/images/tomatoes.png";

// Delivery fee per order, in naira: ₦2,000, or ₦5,000 when the order has anything from
// these main categories. The server decides the real fee (public.delivery_fee_for() in
// supabase/schema.sql); these are for display only, so keep the two in sync.
/** U Angel Foods WhatsApp (0704 905 5555), for wa.me links. */
export const SUPPORT_WHATSAPP = "2347049055555";

export const DELIVERY_FEE = 2000;
export const DELIVERY_FEE_MARKET = 5000;
export const MARKET_CATEGORIES = ["Groceries & Essentials", "The Local Market"];
export const DELIVERY_FEE_NOTE = "₦2,000, or ₦5,000 for orders with groceries or Local Market items";

/** Delivery fee for a product page, from its main category's name. */
export const deliveryFeeForCategory = (mainCategoryName?: string | null) =>
    mainCategoryName && MARKET_CATEGORIES.includes(mainCategoryName) ? DELIVERY_FEE_MARKET : DELIVERY_FEE;

export const ORDER_STATUS_LABELS: Record<string, string> = {
    awaiting_payment: "Awaiting payment",
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    on_the_way: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

// 36 states + the Federal Capital Territory.
export const NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River",
    "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna",
    "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
    "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

export const sides = [
    {
        name: "Fries",
        image: fries,
        price: 3.5,
    },
    {
        name: "Onion Rings",
        image: onionRings,
        price: 4.0,
    },
    {
        name: "Mozarella Sticks",
        image: mozarellaSticks,
        price: 5.0,
    },
    {
        name: "Coleslaw",
        image: coleslaw,
        price: 2.5,
    },
    {
        name: "Salad",
        image: salad,
        price: 4.5,
    },
];

export const toppings = [
    {
        name: "Avocado",
        image: avocado,
        price: 1.5,
    },
    {
        name: "Bacon",
        image: bacon,
        price: 2.0,
    },
    {
        name: "Cheese",
        image: cheese,
        price: 1.0,
    },
    {
        name: "Cucumber",
        image: cucumber,
        price: 0.5,
    },
    {
        name: "Mushrooms",
        image: mushrooms,
        price: 1.2,
    },
    {
        name: "Onions",
        image: onions,
        price: 0.5,
    },
    {
        name: "Tomatoes",
        image: tomatoes,
        price: 0.7,
    },
];

export const images = {
    avatar,
    avocado,
    bacon,
    burgerOne,
    burgerTwo,
    buritto,
    cheese,
    coleslaw,
    cucumber,
    emptyState,
    fries,
    loginGraphic,
    logo,
    mozarellaSticks,
    mushrooms,
    onionRings,
    onions,
    pizzaOne,
    salad,
    success,
    tomatoes,
    arrowBack,
    arrowDown,
    arrowRight,
    bag,
    check,
    clock,
    dollar,
    envelope,
    home,
    location,
    logout,
    minus,
    pencil,
    person,
    phone,
    plus,
    search,
    star,
    trash,
    user,
};
