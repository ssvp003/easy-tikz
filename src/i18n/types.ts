/** The texts of one part of the plugin in another language: every key of its English file, each a string. */
export type Messages<T> = { readonly [K in keyof T]: string };
