import { Document } from "../document.js";
import { Embeddings } from "../embeddings/base.js";
import { VectorStore } from "./base.js";
export type SearchType = "vector" | "hybrid";
export type DistanceStrategy = "euclidean" | "cosine";
interface Neo4jVectorStoreArgs {
    url: string;
    username: string;
    password: string;
    database?: string;
    preDeleteCollection?: boolean;
    textNodeProperty?: string;
    textNodeProperties?: string[];
    embeddingNodeProperty?: string;
    keywordIndexName?: string;
    indexName?: string;
    searchType?: SearchType;
    retrievalQuery?: string;
    nodeLabel?: string;
    createIdIndex?: boolean;
}
export declare class Neo4jVectorStore extends VectorStore {
    private driver;
    private database;
    private preDeleteCollection;
    private nodeLabel;
    private embeddingNodeProperty;
    private embeddingDimension;
    private textNodeProperty;
    private keywordIndexName;
    private indexName;
    private retrievalQuery;
    private searchType;
    private distanceStrategy;
    _vectorstoreType(): string;
    constructor(embeddings: Embeddings, config: Neo4jVectorStoreArgs);
    static initialize(embeddings: Embeddings, config: Neo4jVectorStoreArgs): Promise<Neo4jVectorStore>;
    _initializeDriver({ url, username, password, database, }: Neo4jVectorStoreArgs): Promise<void>;
    _verifyConnectivity(): Promise<void>;
    close(): Promise<void>;
    _dropIndex(): Promise<void>;
    query(query: string, params?: any): Promise<any[]>;
    static fromTexts(texts: string[], metadatas: any, embeddings: Embeddings, config: Neo4jVectorStoreArgs): Promise<Neo4jVectorStore>;
    static fromDocuments(docs: Document[], embeddings: Embeddings, config: Neo4jVectorStoreArgs): Promise<Neo4jVectorStore>;
    static fromExistingIndex(embeddings: Embeddings, config: Neo4jVectorStoreArgs): Promise<Neo4jVectorStore>;
    static fromExistingGraph(embeddings: Embeddings, config: Neo4jVectorStoreArgs): Promise<Neo4jVectorStore>;
    createNewIndex(): Promise<void>;
    retrieveExistingIndex(): Promise<number | null>;
    retrieveExistingFtsIndex(textNodeProperties?: string[]): Promise<string | null>;
    createNewKeywordIndex(textNodeProperties?: string[]): Promise<void>;
    sortByIndexName(values: Array<{
        [key: string]: any;
    }>, indexName: string): Array<{
        [key: string]: any;
    }>;
    addVectors(vectors: number[][], documents: Document[], metadatas?: Record<string, any>[], ids?: string[]): Promise<string[]>;
    addDocuments(documents: Document[]): Promise<string[]>;
    similaritySearch(query: string, k?: number): Promise<Document[]>;
    similaritySearchVectorWithScore(vector: number[], k: number, query: string): Promise<[Document, number][]>;
}
export {};
