import ILoginCredentials from "./ILoginCredentials";

export class InputParser {
    public static parseUrl(sshUrl: string): ILoginCredentials {
        sshUrl = sshUrl.trim();

        const matches: string[] = sshUrl.match(/(.+)@([^:\s]+)(:(\d+))?/);
        if (!matches) {
            return null;
        }

        const login: string = matches[1];
        const host: string = matches[2];
        const port: number = +matches[4];

        const credentials: ILoginCredentials = {
            login,
            host,
            port
        };

        return credentials;
    }

    public static parseCommand(rawInput: string): { argument: string; command: string } | false {
        const [command, argument] = rawInput.trim().split(/\s+/);

        if (["get", "put"].includes(command)) {
            return {command, argument};
        } else {
            return false;
        }
    }
}
