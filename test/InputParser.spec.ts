import {InputParser} from "../app/InputParser";
import {expect} from "chai";
import ILoginCredentials from "../app/ILoginCredentials";

describe("The InputParser", () => {
    it("parses 'put'", () => {
        const input: string = "put /some/file.txt";
        const parsed: { command: string, argument: string } | false = InputParser.parseCommand(input);
        expect(parsed).to.not.be.false;
        if (parsed) {
            const {command, argument} = parsed;
            expect(command).to.equal("put");
            expect(argument).to.equal("/some/file.txt");
        }
    });
    it("parses 'get'", () => {
        const input: string = "get /some/file";
        const parsed: { command: string, argument: string } | false = InputParser.parseCommand(input);
        expect(parsed).to.not.be.false;
        if (parsed) {
            const {command, argument} = parsed;
            expect(command).to.equal("get");
            expect(argument).to.equal("/some/file");
        }
    });
    it("returns false when no custom command", () => {
        const input: string = "cd some-dir";
        const parsed: { command: string, argument: string } | false = InputParser.parseCommand(input);
        expect(parsed).to.be.false;
    });
    it("parses ssh URL with port", () => {
        const sshUrl: string = "name@212.92.100.19:2222";
        const parsed: ILoginCredentials = InputParser.parseUrl(sshUrl);
        expect(parsed.host).to.equal("212.92.100.19");
        expect(parsed.login).to.equal("name");
        expect(parsed.port).to.equal(2222);
    });
    it("parses ssh URL without port", () => {
        const sshUrl: string = "name@212.92.100.19";
        const parsed: ILoginCredentials = InputParser.parseUrl(sshUrl);
        expect(parsed.host).to.equal("212.92.100.19");
        expect(parsed.login).to.equal("name");
    });
});
