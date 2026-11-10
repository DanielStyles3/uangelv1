export const colors = {
    orange: '#FD652A',
    orangeDark: '#C2410C',
    orangeSoft: '#FFF1EA',
    orangeTint: '#FFF4EE',
    orangeBorder: '#FDBA9B',
    orangeText: '#9A3412',
    navy: '#181C2E',
    grey: '#5B5B66',
    greyLight: '#A0A0AB',
    bg: '#F6F6F8',
    white: '#FFFFFF',
    line: '#F0F0F3',
    border: '#ECECF0',
    field: '#F5F5F7',
    fieldBorder: '#E4E4EA',
    chip: '#F3F3F6',
    green: '#15803D',
    greenSoft: '#E9F8EF',
    whatsapp: '#1FA855',
    amber: '#B45309',
    amberSoft: '#FEF3C7',
    blue: '#1D4ED8',
    blueSoft: '#EAF2FF',
    red: '#B91C1C',
    redSoft: '#FDECEC',
    navyMuted: '#C9CBD6',
    peach: '#FFB08A',
};

export const fonts = {
    bold: 'Quicksand-Bold',
    semibold: 'Quicksand-SemiBold',
    medium: 'Quicksand-Medium',
};

export const shadow = {
    shadowColor: '#181C2E',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
};

export const CONTACT = {
    whatsappDisplay: '0704 905 5555',
    whatsappIntl: '2347049055555',
    email: 'uangelfoods@gmail.com',
};

export const referralLink = (code: string) => `https://uangelfoods.com/r/${code}`;

export const shareMessage = (code: string) =>
    `Order tasty home-style food from U Angel Foods in Lagos. Sign up in the U Angel Foods app with my code ${code} before your first order: ${referralLink(code)}`;
