// @ts-check

import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    eslintConfigPrettier,
    eslintPluginPrettierRecommended,
    {
        rules: {
            "prettier/prettier": "error",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "@typescript-eslint/no-duplicate-enum-values": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        files: ["**/*.test.ts"],
        ...vitest.configs.recommended,
        rules: {
            ...vitest.configs.recommended.rules,
            "vitest/prefer-to-be": "error",
            "vitest/prefer-to-contain": "error",
            "vitest/prefer-to-have-length": "error",
            "vitest/expect-expect": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-return": "off",
        },
    }
);
