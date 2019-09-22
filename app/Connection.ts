import {InputParser} from "./InputParser";
import {Client} from "ssh2";
import readline from "readline";
import * as path from "path";
import * as fs from "fs";
import {ReadStream, WriteStream} from "fs";
import ILoginCredentials from "./ILoginCredentials";

export class Connection {
    private readonly credentials: ILoginCredentials;
    private readonly privateKeyPath: string;
    private ignoreNext: boolean;
    private shellStream;
    private connection: Client;

    constructor(sshUrl: string) {
        this.ignoreNext = false;
        this.credentials = InputParser.parseUrl(sshUrl);
        this.privateKeyPath = path.join(process.env.HOME, ".ssh/id_rsa");
    }

    public startSession(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection = new Client();

            this.connection.on("ready", () => {
                this.connection.shell((err, shellStream) => {
                    this.shellStream = shellStream;
                    if (err) {
                        reject(err);
                    }
                    const reader = readline.createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        terminal: false
                    });

                    this.shellStream.on("close", () => {
                        this.connection.end();
                        resolve();
                    }).on("data", (data) => {
                        this.handleShellOutput(data);
                    }).stderr.on("data", (data) => {
                        process.stderr.write(data);
                    });

                    reader.on("line", (line) => {
                        try {
                            this.handleUserInput(line);
                        } catch (err) {
                            console.error("Error during custom command execution");
                        }
                    });
                });
            }).connect({
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.login,
                privateKey: require("fs").readFileSync(this.privateKeyPath)
            });
        });
    }

    private handleShellOutput(data) {
        process.stdin.pause();
        if (!this.ignoreNext) {
            process.stdout.write(data);
        } else {
            const str: string = data.toString().substring(data.indexOf("\n") + 1);
            if (str) {
                process.stdout.write(str);
                this.ignoreNext = false;
            }
        }
        process.stdin.resume();
    }

    private handleUserInput(line) {
        const parsed: { command: string, argument: string } | false = InputParser.parseCommand(line);
        if (parsed) {
            const {command, argument} = parsed;
            if (command === "get") {
                this.get(argument, process.cwd());
            }
            if (command === "put") {
                this.put(argument);
            }
        }
        if (!InputParser.parseCommand(line)) {
            this.ignoreNext = true;
            this.shellStream.write(line.trim() + "\n");
        }
    }

    private get(fromPath: string, toPath: string): void {
        this.connection.sftp((err, sftp) => {
            if (err) {
                console.error("SFTP connection error");
                return;
            }
            const fileNameRegexp: RegExp = /([^\/]+)$/i;
            const matches: string[] = fromPath.match(fileNameRegexp);
            const fileName: string = matches && matches[1];
            toPath = path.join(toPath, fileName);
            console.log(`Downloading file from ${this.credentials.host}:${fromPath} to localhost:${toPath}`);
            sftp.fastGet(fromPath, toPath, {}, (error) => {
                if (error) {
                    console.error("SFTP get error");
                    return;
                }
                console.log("File transferred");
                sftp.end();
            });
        });
    }

    private put(fromPath: string): void {
        this.connection.sftp((err, sftp) => {
            if (err) {
                console.error("SFTP connection error");
                return;
            }
            const fileNameRegexp: RegExp = /\/([^\/]+)$/i;
            const matches: string[] = fromPath.match(fileNameRegexp);
            const fileName: string = matches && matches[1];
            sftp.realpath(".", (e, homePath) => {
                if (e) {
                    console.error("Cannot get the remote path");
                    return;
                }
                const toPath: string = path.join(homePath, fileName);

                const writeStream: WriteStream = sftp.createWriteStream(toPath);
                const readStream: ReadStream = fs.createReadStream(fromPath);

                console.log(`Uploading file from localhost:${fromPath} to ${this.credentials.host}:${toPath}`);

                writeStream.on("close", () => {
                    console.log("File transferred");
                });
                readStream.pipe(writeStream);
            });
        });
    }
}
