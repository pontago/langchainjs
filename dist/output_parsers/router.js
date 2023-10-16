import { JsonMarkdownStructuredOutputParser } from "./structured.js";
import { OutputParserException } from "../schema/output_parser.js";
/**
 * A type of output parser that extends the
 * JsonMarkdownStructuredOutputParser. It is used to parse the output of a
 * router in LangChain. The class takes a schema and an optional
 * RouterOutputParserInput object as parameters.
 */
export class RouterOutputParser extends JsonMarkdownStructuredOutputParser {
    constructor(schema, options) {
        super(schema);
        Object.defineProperty(this, "defaultDestination", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "DEFAULT"
        });
        this.defaultDestination =
            options?.defaultDestination ?? this.defaultDestination;
    }
    /**
     * Overrides the parse method from JsonMarkdownStructuredOutputParser.
     * This method takes a string as input, attempts to parse it, and returns
     * the parsed text. If the destination of the parsed text matches the
     * defaultDestination, the destination is set to null. If the parsing
     * fails, an OutputParserException is thrown.
     * @param text The text to be parsed.
     * @returns The parsed text as a Promise.
     */
    async parse(text) {
        try {
            const parsedText = await super.parse(text);
            if (parsedText.destination?.toLowerCase() ===
                this.defaultDestination.toLowerCase()) {
                parsedText.destination = null;
            }
            return parsedText;
        }
        catch (e) {
            throw new OutputParserException(`Failed to parse. Text: "${text}". Error: ${e}`, text);
        }
    }
}
