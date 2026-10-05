/**
 * The team section renders this list. Add a person by adding an object.
 * `links` is optional; each link needs a label and an https URL.
 */
export type Member = {
  name: string;
  role: string;
  bio?: string;
  links?: { label: string; href: string }[];
};

export const team: Member[] = [
  {
    name: "Jagadeesh B",
    role: "Stellar India Ambassador",
    bio: "Builds on Soroban and ships in the open: the measurements, the negative results and the upstream issues are published in the repository.",
    links: [
      { label: "GitHub @Jagadeeshftw", href: "https://github.com/Jagadeeshftw" },
    ],
  },
];
