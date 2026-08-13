import type { ImageSourcePropType } from "react-native";

export type HomeSectionId = "inicio" | "programas" | "acompanhamento" | "camps" | "loja" | "conteudo";

export type HomeNavItem = {
  id: HomeSectionId;
  label: string;
};

export const homeNavigation: HomeNavItem[] = [
  { id: "inicio", label: "Início" },
  { id: "programas", label: "Programas" },
  { id: "acompanhamento", label: "Acompanhamento" },
  { id: "camps", label: "Camps" },
  { id: "loja", label: "Loja" },
  { id: "conteudo", label: "Conteúdo" }
];

export const featuredPrograms = [
  {
    number: "01",
    type: "PROGRAMA CONTÍNUO",
    title: "FitBlock Training",
    detail: "Força · endurance · mixed",
    accent: "purple"
  },
  {
    number: "02",
    type: "CICLO DE 8 SEMANAS",
    title: "Método Híbrido",
    detail: "Performance para a vida real",
    accent: "graphite"
  },
  {
    number: "03",
    type: "ACOMPANHAMENTO",
    title: "FitBlock Personalizado",
    detail: "Seu objetivo. Seu ritmo.",
    accent: "soft"
  }
] as const;

export type ExperienceStatus = "open" | "last_spots" | "closed" | "interest" | "completed";

export type FitBlockExperience = {
  id: string;
  order: number;
  typeLabel: "CAMP" | "LAB" | "MEET";
  /** Imagem editorial opcional; os dados do evento continuam independentes da sua apresentação. */
  coverImage?: ImageSourcePropType;
  title: string;
  date: string;
  location: string;
  status: ExperienceStatus;
  href: string;
  external: boolean;
};

export const experienceStatusLabels: Record<ExperienceStatus, string> = {
  open: "Inscrições abertas",
  last_spots: "Últimas vagas",
  closed: "Inscrições encerradas",
  interest: "Lista de interesse",
  completed: "Evento realizado"
};

export const trainingCampExperience: FitBlockExperience = {
  id: "fitblock-training-camp-2026",
  order: 1,
  typeLabel: "CAMP",
  coverImage: require("@/assets/training-camp-banner.png"),
  title: "FitBlock Training Camp",
  date: "29 AGO 2026",
  location: "PulseFit · João Pessoa",
  status: "open",
  href: "https://www.wodarena.com.br/event/evt-org-1-training-camp-fitblock-mri7wxfh-647720",
  external: true
};

export const featuredCamps = [trainingCampExperience] as const;

export const editorialPosts = [
  { category: "MÉTODO", title: "Como treinar com consistência quando a semana aperta", number: "01" },
  { category: "PERFORMANCE", title: "Força é uma prática — não um momento", number: "02" },
  { category: "COMUNIDADE", title: "O treino termina. O processo continua.", number: "03" }
] as const;
