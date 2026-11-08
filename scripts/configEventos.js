const EVENTOS_SEMANAIS = [
    {
        codigo: "TC1",
        dia: 0,
        horario: "20:30",
        url: "https://ving.mobi/clanTourney/history2"
    },
    {
        codigo: "GC1",
        dia: 1,
        horario: "20:30",
        url: "https://ving.mobi/army/history2"
    },
    {
        codigo: "IT1",
        dia: 2,
        horario: "20:00",
        url: "https://ving.mobi/clanSurvival/history2"
    },
    {
        codigo: "CT1",
        dia: 2,
        horario: "20:30",
        url: "https://ving.mobi/tower_history"
    },
    {
        codigo: "TC2",
        dia: 3,
        horario: "20:30",
        url: "https://ving.mobi/clanTourney/history2"
    },
    {
        codigo: "BT1",
        dia: 3,
        horario: "20:30",
        url: "https://ving.mobi/throne_history"
    },
    {
        codigo: "GC2",
        dia: 4,
        horario: "20:30",
        url: "https://ving.mobi/army/history2"
    },
    {
        codigo: "CT2",
        dia: 5,
        horario: "20:30",
        url: "https://ving.mobi/tower_history"
    },
    {
        codigo: "IT2",
        dia: 6,
        horario: "20:00",
        url: "https://ving.mobi/clanSurvival/history2"
    },
    {
        codigo: "BT2",
        dia: 6,
        horario: "20:30",
        url: "https://ving.mobi/throne_history"
    }
];

const ORDEM_EVENTOS = EVENTOS_SEMANAIS.map(
    (evento) => evento.codigo
);