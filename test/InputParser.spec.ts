import {InputParser} from "../app/InputParser";
import {expect} from "chai";

describe("The InputParser", () => {
    it("parses 'put'", () => {
        const input = "put /some/file.txt";
        const parsed = InputParser.parseCommand(input);
        expect(parsed).to.not.be.false;
        if (parsed) {
            const {command, argument} = parsed;
            expect(command).to.equal("put");
            expect(argument).to.equal("/some/file.txt");
        }
    });
    it("parses 'get'", () => {
        const input = "get /some/file";
        const parsed = InputParser.parseCommand(input);
        expect(parsed).to.not.be.false;
        if (parsed) {
            const {command, argument} = parsed;
            expect(command).to.equal("get");
            expect(argument).to.equal("/some/file");
        }
    });
    it("returns false when no custom command", () => {
        const input = "cd some-dir";
        const parsed = InputParser.parseCommand(input);
        expect(parsed).to.be.false;
    });
    it("parses ssh URL with port", () => {
        const sshUrl = "name@212.92.100.19:2222";
        const parsed = InputParser.parseUrl(sshUrl);
        expect(parsed.host).to.equal("212.92.100.19");
        expect(parsed.login).to.equal("name");
        expect(parsed.port).to.equal(2222);
    });
    it("parses ssh URL without port", () => {
        const sshUrl = "name@212.92.100.19";
        const parsed = InputParser.parseUrl(sshUrl);
        expect(parsed.host).to.equal("212.92.100.19");
        expect(parsed.login).to.equal("name");
    });
});
