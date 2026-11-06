export interface AgentInvocation {
    command: string;
    args: string[];
}
/** Generated tools pass user input as argv, never as shell program text. */
export declare function agentInvocation(style: 'local' | 'global' | 'npx', local: AgentInvocation, platform?: NodeJS.Platform): AgentInvocation;
