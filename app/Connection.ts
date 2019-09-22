import {InputParser} from "./InputParser";
import {Client} from "ssh2";
import readline from "readline";
import * as path from "path";
import * as fs from "fs";
import {ReadStream, WriteStream} from "fs";
import ILoginCredentials from "./ILoginCredentials";
import * as os from "os";
import {exec} from "child_process";

export class Connection {

    private static handleShellOutput(data) {
        process.stdin.pause();
        process.stdout.write(data);
        process.stdin.resume();
    }

    private readonly credentials: ILoginCredentials;
    private readonly forwardRule: string;
    private readonly privateKeyPath: string;
    private shellStream;
    private connection: Client;

    constructor(sshUrl: string, forwardRule?: string) {
        this.credentials = InputParser.parseUrl(sshUrl);
        this.forwardRule = forwardRule;
        this.privateKeyPath = `${os.homedir()}${path.sep}.ssh${path.sep}id_rsa`;
    }

    public async startInteractiveSession(): Promise<void> {
        await this.createConnection();
        await this.startShell();
    }

    public async forward(): Promise<void> {
        return new Promise((resolve, reject) => {
            const ssh = exec(`ssh -N -L ${this.forwardRule} ${this.credentials.login}@${this.credentials.host} ${this.credentials.port && "-P" + this.credentials.port || "-P22"}`);
            console.log("SSH tunnel created");
            process.on("SIGINT", () => {
                ssh.kill();
                resolve();
            });
        });
    }

    private async createConnection(): Promise<void> {
        this.connection = await this.connect();
    }

    private async connect(): Promise<Client> {
        return new Promise<Client>((resolve) => {
            const connection = new Client();
            connection.connect({
                host: this.credentials.host,
                port: this.credentials.port,
                username: this.credentials.login,
                privateKey: require("fs").readFileSync(this.privateKeyPath)
            });
            connection.on("ready", () => {
                resolve(connection);
            });
        });
    }

    private async startShell() {
        return new Promise((resolve, reject) => {
            this.connection.shell((err, stream) => {
                if (err) {
                    return reject(err);
                }
                this.shellStream = stream;

                // prevent output doubling
                this.shellStream.write("stty -echo\n");

                this.shellStream.on("close", async () => {
                    this.shellStream.end();
                    this.connection.end();
                    return resolve();
                }).on("data", (data) => {
                    Connection.handleShellOutput(data);
                }).stderr.on("data", (data) => {
                    process.stderr.write(data);
                });

                const reader = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                    terminal: false
                });

                reader.on("line", (line) => {
                    try {
                        this.handleUserInput(line);
                    } catch (err) {
                        console.error("Error during custom command execution");
                    }
                });
            });
        });

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
