export declare function greet(name: string): string;
export declare class Greeter {
    greet(name: string): string;
}
export declare const DEFAULT_NAME = "World";
export type Config = {
    name: string;
    verbose: boolean;
};
export interface Logger {
    log(msg: string): void;
    warn(msg: string): void;
}
