import {
  type CategoricalField,
  DrinkingSchema,
  MaritalStatusSchema,
  SmokingSchema,
} from "@/domain/schemas";

export interface Region {
  motherTongue: string;
  religion: string;
  communities: string[];
  cities: string[];
  weight: number;
  maleNames: string[];
  femaleNames: string[];
  surnames: string[];
}

export const rows = (table: string) => table.trim().split("\n");
export const cells = (row: string) => row.split("|").map((cell) => cell.trim());
export const list = (text: string, separator = ",") =>
  text.split(separator).map((item) => item.trim());

const REGION_TABLE = `
Marathi   | Hindu     | Maratha, Deshastha Brahmin, CKP        | Pune, Mumbai         | 13 | Aniket Omkar Tejas Ninad Sahil     | Sayali Mrunal Ketaki Gauri Rutuja | Kulkarni Deshpande Patil Gokhale Joshi
Hindi     | Hindu     | Kayastha, Agarwal, Rajput              | Delhi NCR            | 14 | Rohit Varun Abhishek Kunal Ankit   | Neha Shruti Ananya Ritika Pooja   | Sharma Srivastava Agarwal Chauhan Saxena
Telugu    | Hindu     | Reddy, Kamma, Niyogi Brahmin           | Hyderabad            | 11 | Srikanth Karthik Vamsi Harsha      | Sravya Keerthi Harika Lasya       | Reddy Rao Chowdary Varma
Tamil     | Hindu     | Iyer, Iyengar, Mudaliar                | Chennai              | 11 | Arjun Vignesh Pranav Siddharth     | Divya Janani Nandhini Aishwarya   | Raghavan Subramanian Natarajan Krishnan
Kannada   | Hindu     | Lingayat, Vokkaliga, Madhwa Brahmin    | Bengaluru            | 9  | Rakshit Chiranjeev Pavan Nikhil    | Apeksha Sinchana Chaitra Spoorthi | Gowda Hegde Shetty Bhat
Bengali   | Hindu     | Kayastha, Baidya, Bengali Brahmin      | Kolkata              | 9  | Arnab Sayan Debojyoti Ritwik       | Ishita Poulomi Sreeja Moumita     | Banerjee Ghosh Mukherjee Sen
Gujarati  | Hindu     | Patel, Lohana, Nagar Brahmin           | Ahmedabad, Mumbai    | 8  | Hardik Parth Dhruv Chirag          | Khushi Riddhi Hetal Nidhi         | Patel Desai Mehta Vyas
Gujarati  | Jain      | Shwetambar, Digambar                   | Ahmedabad, Mumbai    | 4  | Moksh Jinay Harsh                  | Palak Dhara Krupa                 | Shah Sanghvi Jain
Punjabi   | Sikh      | Jat Sikh, Khatri, Arora                | Delhi NCR            | 8  | Harpreet Gurdeep Jaskaran Amandeep | Simran Navneet Harleen Jasleen    | Gill Sandhu Ahluwalia Bedi
Malayalam | Christian | Syro-Malabar, Marthoma, Latin Catholic | Bengaluru, Chennai   | 6  | Jithin Alan Tony Jobin             | Anu Merin Reshma Ann              | Thomas Mathew Kurian Varghese
Urdu      | Muslim    | Sunni, Shia                            | Hyderabad, Delhi NCR | 6  | Imran Faizan Sameer Adil           | Ayesha Sana Zoya Mehreen          | Khan Siddiqui Qureshi Ansari
`;

export const REGIONS: readonly Region[] = rows(REGION_TABLE).map((row) => {
  const [motherTongue, religion, communities, cities, weight, ...names] =
    cells(row);
  const [maleNames, femaleNames, surnames] = names.map((cell) =>
    list(cell, " ").filter(Boolean),
  );
  return {
    motherTongue,
    religion,
    communities: list(communities),
    cities: list(cities),
    weight: Number(weight),
    maleNames,
    femaleNames,
    surnames,
  };
});

export const ABROAD_CITIES = list("London, Dubai, Singapore, SF Bay Area");
export const HUB_CITIES = list("Mumbai, Bengaluru, Pune, Hyderabad, Delhi NCR");
export const ALL_CITIES = [
  ...new Set(REGIONS.flatMap(({ cities }) => cities)),
  ...ABROAD_CITIES,
];
export const TECH_PROFESSIONS = list(
  "Software engineer, Data scientist, Product manager",
);
export const PROFESSIONS = [
  ...TECH_PROFESSIONS,
  ...list(
    "Doctor, Chartered accountant, Lawyer, Architect, Investment banker, Civil servant, Professor, Startup founder, Consultant",
  ),
];
export const HOBBIES = list(
  "trekking, filter coffee, Carnatic music, badminton, baking, long drives, cricket, stand-up comedy, reading history, board games",
);

export const TRAIT_WEIGHTS = {
  maritalStatus: { never_married: 86, divorced: 11, widowed: 3 },
  wantsChildren: { yes: 70, open: 20, no: 10 },
  smoking: { never: 80, occasionally: 15, regularly: 5 },
  drinking: { never: 45, socially: 45, regularly: 10 },
  diet: { veg: 44, non_veg: 42, eggetarian: 14 },
  education: { bachelors: 30, masters: 40, professional: 20, doctorate: 10 },
  incomeBandLakhs: { "<10": 12, "10-25": 38, "25-50": 34, "50+": 16 },
  familyType: { nuclear: 63, joint: 37 },
} as const;

export const UNKNOWN_SHARES = {
  smoking: 0.2,
  drinking: 0.2,
  wantsChildren: 0.2,
  openToRelocate: 0.1,
  community: 0.1,
  diet: 0.09,
  familyType: 0.08,
} as const;

/** Most widely acceptable value first, so a candidate fitted to one client suits many others. */
export const VALUES_BY_ACCEPTANCE: Partial<
  Record<CategoricalField, readonly string[]>
> = {
  maritalStatus: MaritalStatusSchema.options,
  wantsChildren: ["open", "yes", "no"],
  smoking: SmokingSchema.options,
  drinking: DrinkingSchema.options,
  diet: ["veg", "jain", "eggetarian", "non_veg"],
};
