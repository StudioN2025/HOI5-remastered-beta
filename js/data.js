// data.js — все константы и данные игры

export const COUNTRIES = {
    "germany": { name: "Германия", color: "#3a3a3a", leader: "Адольф Гитлер", ideology: "Фашизм" },
    "ussr": { name: "СССР", color: "#990000", leader: "Иосиф Сталин", ideology: "Коммунизм" },
    "poland": { name: "Польша", color: "#ffc0cb", leader: "Игнаций Мосцицкий", ideology: "Нейтралитет" },
    "france": { name: "Франция", color: "#3b82f6", leader: "Альбер Лебрен", ideology: "Демократия" },
    "uk": { name: "Великобритания", color: "#ef4444", leader: "Невилл Чемберлен", ideology: "Демократия" },
    "italy": { name: "Италия", color: "#166534", leader: "Бенито Муссолини", ideology: "Фашизм" },
    "spain": { name: "Испания", color: "#fbbf24", leader: "Франсиско Франко", ideology: "Фашизм" },
    "portugal": { name: "Португалия", color: "#105d10", leader: "Антониу Салазар", ideology: "Нейтралитет" },
    "netherlands": { name: "Нидерланды", color: "#f97316", leader: "Вильгельмина", ideology: "Демократия" },
    "belgium": { name: "Бельгия", color: "#eab308", leader: "Леопольд III", ideology: "Демократия" },
    "luxembourg": { name: "Люксембург", color: "#67e8f9", leader: "Шарлотта", ideology: "Демократия" },
    "switzerland": { name: "Швейцария", color: "#dc2626", leader: "Джузеппе Мотта", ideology: "Демократия" },
    "romania": { name: "Румыния", color: "#eab308", leader: "Кароль II", ideology: "Нейтралитет" },
    "hungary": { name: "Венгрия", color: "#166534", leader: "Миклош Хорти", ideology: "Нейтралитет" },
    "bulgaria": { name: "Болгария", color: "#105d10", leader: "Борис III", ideology: "Нейтралитет" },
    "finland": { name: "Финляндия", color: "#ffffff", leader: "Кюёсти Каллио", ideology: "Нейтралитет" },
    "czechoslovakia": { name: "Чехословакия", color: "#3b82f6", leader: "Эдвард Бенеш", ideology: "Демократия" },
    "austria": { name: "Австрия", color: "#ef4444", leader: "Курт Шушниг", ideology: "Нейтралитет" },
    "denmark": { name: "Дания", color: "#ef4444", leader: "Кристиан X", ideology: "Демократия" },
    "greece": { name: "Греция", color: "#60a5fa", leader: "Иоаннис Метаксас", ideology: "Нейтралитет" },
    "yugoslavia": { name: "Югославия", color: "#1e3a8a", leader: "Пётр II", ideology: "Нейтралитет" },
    "lithuania": { name: "Литва", color: "#065f46", leader: "Антанас Сметона", ideology: "Нейтралитет" },
    "latvia": { name: "Латвия", color: "#8b0000", leader: "Карлис Улманис", ideology: "Нейтралитет" },
    "estonia": { name: "Эстония", color: "#4682b4", leader: "Константин Пятс", ideology: "Нейтралитет" },
    "slovakia": { name: "Словакия", color: "#60a5fa", leader: "Йозеф Тисо", ideology: "Фашизм" }
};

export const UNIT_STATS = {
    infantry: { 
        name: "Пехота", icon: "💂", 
        costEquipment: 100, costManpower: 1000,
        attack: 10, defense: 25, hp: 100, armor: 0,
        maintenance: 0.2
    },
    tank: { 
        name: "Танки", icon: "🚜", 
        costEquipment: 800, costManpower: 500,
        attack: 45, defense: 15, hp: 50, armor: 30,
        maintenance: 1.5
    }
};

export const BUILDING_STATS = {
    factory: { name: "Военный завод", icon: "🏭", costEquipment: 500, buildTime: 135 },
    port: { name: "Морской порт", icon: "⚓", costEquipment: 300, buildTime: 90 }
};

export const TECH_TREE = {
    industry: { name: "Промышленность", maxLevel: 5, bonus: 0.05 },
    infantry: { name: "Пехота", maxLevel: 5, bonus: 0.05 },
    tank: { name: "Танки", maxLevel: 5, bonus: 0.05 }
};

export const NATIONAL_FOCUSES = {
    germany: [
        { id: 'german_rearmament', name: 'Перевооружение', description: '+1000 снаряжения', 
          effect: (ctx) => { ctx.resources.equipment += 1000; } },
        { id: 'german_danzig', name: 'Данциг или война', description: 'Война с Польшей', 
          effect: (ctx) => { ctx.declareWar('poland'); } },
        { id: 'german_axis', name: 'Ось', description: 'Альянс с Италией', 
          effect: (ctx) => { ctx.proposeAlliance('italy'); } }
    ],
    ussr: [
        { id: 'ussr_five_year', name: 'Пятилетка', description: '+3 фабрики', 
          effect: (ctx) => { /* добавить фабрики */ } },
        { id: 'ussr_patriotic', name: 'Великая Отечественная', description: 'Мобилизация', 
          effect: (ctx) => { /* мобилизация */ } }
    ]
};

export const DEMO_MAP = {
    gridData: {
        "10,10": "germany", "11,10": "germany", "12,10": "germany",
        "10,11": "germany", "11,11": "germany", "12,11": "germany",
        "10,12": "poland", "11,12": "poland", "12,12": "poland",
        "5,10": "france", "6,10": "france", "7,10": "france",
        "5,11": "france", "6,11": "france",
        "15,10": "ussr", "16,10": "ussr", "15,11": "ussr", "16,11": "ussr",
        "8,8": "uk", "9,8": "uk",
        "13,13": "italy", "14,13": "italy",
        "9,9": "belgium", "10,9": "netherlands"
    },
    cellStats: {},
    version: "1.0"
};
