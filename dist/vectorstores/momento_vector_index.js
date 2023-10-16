/* eslint-disable no-instanceof/no-instanceof */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ALL_VECTOR_METADATA, CreateVectorIndex, VectorUpsertItemBatch, VectorDeleteItemBatch, VectorSearch, } from "@gomomento/sdk-core";
import * as uuid from "uuid";
import { Document } from "../document.js";
import { VectorStore } from "./base.js";
/**
 * A vector store that uses the Momento Vector Index.
 *
 * @remarks
 * To sign up for a free Momento account, visit https://console.gomomento.com.
 */
export class MomentoVectorIndex extends VectorStore {
    _vectorstoreType() {
        return "momento";
    }
    /**
     * Creates a new `MomentoVectorIndex` instance.
     * @param embeddings The embeddings instance to use to generate embeddings from documents.
     * @param args The arguments to use to configure the vector store.
     */
    constructor(embeddings, args) {
        super(embeddings, args);
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "indexName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "textField", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_ensureIndexExists", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.embeddings = embeddings;
        this.client = args.client;
        this.indexName = args.indexName ?? "default";
        this.textField = args.textField ?? "text";
        this._ensureIndexExists = args.ensureIndexExists ?? true;
    }
    /**
     * Returns the Momento Vector Index client.
     * @returns The Momento Vector Index client.
     */
    getClient() {
        return this.client;
    }
    /**
     * Creates the index if it does not already exist.
     * @param numDimensions The number of dimensions of the vectors to be stored in the index.
     * @returns Promise that resolves to true if the index was created, false if it already existed.
     */
    async ensureIndexExists(numDimensions) {
        const response = await this.client.createIndex(this.indexName, numDimensions);
        if (response instanceof CreateVectorIndex.Success) {
            return true;
        }
        else if (response instanceof CreateVectorIndex.AlreadyExists) {
            return false;
        }
        else if (response instanceof CreateVectorIndex.Error) {
            throw new Error(response.toString());
        }
        else {
            throw new Error(`Unknown response type: ${response.toString()}`);
        }
    }
    /**
     * Converts the metadata to a format that can be stored in the index.
     *
     * @remarks stringifies all values in the metadata object
     * @param metadata The metadata to convert.
     * @returns The converted metadata.
     */
    static prepareMetadata(metadata) {
        return Object.fromEntries(Object.entries(metadata).map(([key, val]) => [key, JSON.stringify(val)]));
    }
    /**
     * Converts the documents to a format that can be stored in the index.
     *
     * This is necessary because the Momento Vector Index requires that the metadata
     * be a map of strings to strings.
     * @param vectors The vectors to convert.
     * @param documents The documents to convert.
     * @param ids The ids to convert.
     * @returns The converted documents.
     */
    prepareItemBatch(vectors, documents, ids) {
        return vectors.map((vector, idx) => ({
            id: ids[idx],
            vector,
            metadata: {
                ...MomentoVectorIndex.prepareMetadata(documents[idx].metadata),
                [this.textField]: documents[idx].pageContent,
            },
        }));
    }
    /**
     * Adds vectors to the index.
     *
     * @remarks If the index does not already exist, it will be created if `ensureIndexExists` is true.
     * @param vectors The vectors to add to the index.
     * @param documents The documents to add to the index.
     * @param documentProps The properties of the documents to add to the index, specifically the ids.
     * @returns Promise that resolves when the vectors have been added to the index. Also returns the ids of the
     * documents that were added.
     */
    async addVectors(vectors, documents, documentProps) {
        if (vectors.length === 0) {
            return;
        }
        if (documents.length !== vectors.length) {
            throw new Error(`Number of vectors (${vectors.length}) does not equal number of documents (${documents.length})`);
        }
        if (vectors.some((v) => v.length !== vectors[0].length)) {
            throw new Error("All vectors must have the same length");
        }
        if (documentProps?.ids !== undefined &&
            documentProps.ids.length !== vectors.length) {
            throw new Error(`Number of ids (${documentProps?.ids?.length || "null"}) does not equal number of vectors (${vectors.length})`);
        }
        if (this._ensureIndexExists) {
            await this.ensureIndexExists(vectors[0].length);
        }
        const documentIds = documentProps?.ids ?? documents.map(() => uuid.v4());
        const batchSize = 128;
        const numBatches = Math.ceil(vectors.length / batchSize);
        // Add each batch of vectors to the index
        for (let i = 0; i < numBatches; i += 1) {
            const [startIndex, endIndex] = [
                i * batchSize,
                Math.min((i + 1) * batchSize, vectors.length),
            ];
            const batchVectors = vectors.slice(startIndex, endIndex);
            const batchDocuments = documents.slice(startIndex, endIndex);
            const batchDocumentIds = documentIds.slice(startIndex, endIndex);
            // Insert the items to the index
            const response = await this.client.upsertItemBatch(this.indexName, this.prepareItemBatch(batchVectors, batchDocuments, batchDocumentIds));
            if (response instanceof VectorUpsertItemBatch.Success) {
                // eslint-disable-next-line no-continue
                continue;
            }
            else if (response instanceof VectorUpsertItemBatch.Error) {
                throw new Error(response.toString());
            }
            else {
                throw new Error(`Unknown response type: ${response.toString()}`);
            }
        }
    }
    /**
     * Adds vectors to the index. Generates embeddings from the documents
     * using the `Embeddings` instance passed to the constructor.
     * @param documents Array of `Document` instances to be added to the index.
     * @returns Promise that resolves when the documents have been added to the index.
     */
    async addDocuments(documents, documentProps) {
        const texts = documents.map(({ pageContent }) => pageContent);
        await this.addVectors(await this.embeddings.embedDocuments(texts), documents, documentProps);
    }
    /**
     * Deletes vectors from the index by id.
     * @param params The parameters to use to delete the vectors, specifically the ids.
     */
    async delete(params) {
        const response = await this.client.deleteItemBatch(this.indexName, params.ids);
        if (response instanceof VectorDeleteItemBatch.Success) {
            // pass
        }
        else if (response instanceof VectorDeleteItemBatch.Error) {
            throw new Error(response.toString());
        }
        else {
            throw new Error(`Unknown response type: ${response.toString()}`);
        }
    }
    /**
     * Searches the index for the most similar vectors to the query vector.
     * @param query The query vector.
     * @param k The number of results to return.
     * @returns Promise that resolves to the documents of the most similar vectors
     * to the query vector.
     */
    async similaritySearchVectorWithScore(query, k) {
        const response = await this.client.search(this.indexName, query, {
            topK: k,
            metadataFields: ALL_VECTOR_METADATA,
        });
        if (response instanceof VectorSearch.Success) {
            if (response.hits === undefined) {
                return [];
            }
            return response.hits().map((hit) => [
                new Document({
                    pageContent: hit.metadata[this.textField] ?? "",
                    metadata: Object.fromEntries(Object.entries(hit.metadata)
                        .filter(([key]) => key !== this.textField)
                        .map(([key, val]) => [key, JSON.parse(val)])),
                }),
                hit.distance,
            ]);
        }
        else if (response instanceof VectorSearch.Error) {
            throw new Error(response.toString());
        }
        else {
            throw new Error(`Unknown response type: ${response.toString()}`);
        }
    }
    /**
     * Stores the documents in the index.
     *
     * Converts the documents to vectors using the `Embeddings` instance passed.
     * @param texts The texts to store in the index.
     * @param metadatas The metadata to store in the index.
     * @param embeddings The embeddings instance to use to generate embeddings from the documents.
     * @param dbConfig The configuration to use to instantiate the vector store.
     * @param documentProps The properties of the documents to add to the index, specifically the ids.
     * @returns Promise that resolves to the vector store.
     */
    static async fromTexts(texts, metadatas, embeddings, dbConfig, documentProps) {
        if (Array.isArray(metadatas) && texts.length !== metadatas.length) {
            throw new Error(`Number of texts (${texts.length}) does not equal number of metadatas (${metadatas.length})`);
        }
        const docs = [];
        for (let i = 0; i < texts.length; i += 1) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const metadata = Array.isArray(metadatas)
                ? metadatas[i]
                : metadatas;
            const newDoc = new Document({
                pageContent: texts[i],
                metadata,
            });
            docs.push(newDoc);
        }
        return await this.fromDocuments(docs, embeddings, dbConfig, documentProps);
    }
    /**
     * Stores the documents in the index.
     * @param docs The documents to store in the index.
     * @param embeddings The embeddings instance to use to generate embeddings from the documents.
     * @param dbConfig The configuration to use to instantiate the vector store.
     * @param documentProps The properties of the documents to add to the index, specifically the ids.
     * @returns Promise that resolves to the vector store.
     */
    static async fromDocuments(docs, embeddings, dbConfig, documentProps) {
        const vectorStore = new MomentoVectorIndex(embeddings, dbConfig);
        await vectorStore.addDocuments(docs, documentProps);
        return vectorStore;
    }
}
