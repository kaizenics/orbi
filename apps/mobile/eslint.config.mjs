import { config } from "@orbi/eslint-config/react";

/** @type {import("eslint").Linter.Config[]} */
export default [...config, { ignores: [".expo/**", "android/**", "ios/**"] }];
