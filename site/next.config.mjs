import { createMDX } from "fumadocs-mdx/next";
/** @type {import('next').NextConfig} */
const nextConfig = { turbopack: { root: import.meta.dirname } };
export default createMDX()(nextConfig);
