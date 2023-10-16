"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPromptTemplateFromDataSource = exports.generateTableInfoFromTables = exports.getTableAndColumnsName = exports.verifyIgnoreTablesExistInDatabase = exports.verifyIncludeTablesExistInDatabase = exports.verifyListTablesExistInDatabase = void 0;
const sql_db_prompt_js_1 = require("../chains/sql_db/sql_db_prompt.cjs");
const verifyListTablesExistInDatabase = (tablesFromDatabase, listTables, errorPrefixMsg) => {
    const onlyTableNames = tablesFromDatabase.map((table) => table.tableName);
    if (listTables.length > 0) {
        for (const tableName of listTables) {
            if (!onlyTableNames.includes(tableName)) {
                throw new Error(`${errorPrefixMsg} the table ${tableName} was not found in the database`);
            }
        }
    }
};
exports.verifyListTablesExistInDatabase = verifyListTablesExistInDatabase;
const verifyIncludeTablesExistInDatabase = (tablesFromDatabase, includeTables) => {
    (0, exports.verifyListTablesExistInDatabase)(tablesFromDatabase, includeTables, "Include tables not found in database:");
};
exports.verifyIncludeTablesExistInDatabase = verifyIncludeTablesExistInDatabase;
const verifyIgnoreTablesExistInDatabase = (tablesFromDatabase, ignoreTables) => {
    (0, exports.verifyListTablesExistInDatabase)(tablesFromDatabase, ignoreTables, "Ignore tables not found in database:");
};
exports.verifyIgnoreTablesExistInDatabase = verifyIgnoreTablesExistInDatabase;
const formatToSqlTable = (rawResultsTableAndColumn) => {
    const sqlTable = [];
    for (const oneResult of rawResultsTableAndColumn) {
        const sqlColumn = {
            columnName: oneResult.column_name,
            dataType: oneResult.data_type,
            isNullable: oneResult.is_nullable === "YES",
        };
        const currentTable = sqlTable.find((oneTable) => oneTable.tableName === oneResult.table_name);
        if (currentTable) {
            currentTable.columns.push(sqlColumn);
        }
        else {
            const newTable = {
                tableName: oneResult.table_name,
                columns: [sqlColumn],
            };
            sqlTable.push(newTable);
        }
    }
    return sqlTable;
};
const getTableAndColumnsName = async (appDataSource) => {
    let sql;
    if (appDataSource.options.type === "postgres") {
        const schema = appDataSource.options?.schema ?? "public";
        sql = `SELECT 
            t.table_name, 
            c.* 
          FROM 
            information_schema.tables t 
              JOIN information_schema.columns c 
                ON t.table_name = c.table_name 
          WHERE 
            t.table_schema = '${schema}' 
              AND c.table_schema = '${schema}' 
          ORDER BY 
            t.table_name,
            c.ordinal_position;`;
        const rep = await appDataSource.query(sql);
        return formatToSqlTable(rep);
    }
    if (appDataSource.options.type === "sqlite") {
        sql =
            "SELECT \n" +
                "   m.name AS table_name,\n" +
                "   p.name AS column_name,\n" +
                "   p.type AS data_type,\n" +
                "   CASE \n" +
                "      WHEN p.\"notnull\" = 0 THEN 'YES' \n" +
                "      ELSE 'NO' \n" +
                "   END AS is_nullable \n" +
                "FROM \n" +
                "   sqlite_master m \n" +
                "JOIN \n" +
                "   pragma_table_info(m.name) p \n" +
                "WHERE \n" +
                "   m.type = 'table' AND \n" +
                "   m.name NOT LIKE 'sqlite_%';\n";
        const rep = await appDataSource.query(sql);
        return formatToSqlTable(rep);
    }
    if (appDataSource.options.type === "mysql") {
        sql =
            "SELECT " +
                "TABLE_NAME AS table_name, " +
                "COLUMN_NAME AS column_name, " +
                "DATA_TYPE AS data_type, " +
                "IS_NULLABLE AS is_nullable " +
                "FROM INFORMATION_SCHEMA.COLUMNS " +
                `WHERE TABLE_SCHEMA = '${appDataSource.options.database}';`;
        const rep = await appDataSource.query(sql);
        return formatToSqlTable(rep);
    }
    if (appDataSource.options.type === "mssql") {
        sql =
            "SELECT " +
                "TABLE_NAME AS table_name, " +
                "COLUMN_NAME AS column_name, " +
                "DATA_TYPE AS data_type, " +
                "IS_NULLABLE AS is_nullable " +
                "FROM INFORMATION_SCHEMA.COLUMNS " +
                "ORDER BY TABLE_NAME, ORDINAL_POSITION;";
        const rep = await appDataSource.query(sql);
        return formatToSqlTable(rep);
    }
    if (appDataSource.options.type === "sap") {
        const schema = appDataSource.options?.schema ?? "public";
        sql = `SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE_NAME AS data_type,
        CASE WHEN IS_NULLABLE='TRUE' THEN 'YES' ELSE 'NO' END AS is_nullable
      FROM TABLE_COLUMNS
      WHERE SCHEMA_NAME='${schema}'`;
        const rep = await appDataSource.query(sql);
        const repLowerCase = [];
        rep.forEach((_rep) => repLowerCase.push({
            table_name: _rep.TABLE_NAME,
            column_name: _rep.COLUMN_NAME,
            data_type: _rep.DATA_TYPE,
            is_nullable: _rep.IS_NULLABLE,
        }));
        return formatToSqlTable(repLowerCase);
    }
    throw new Error("Database type not implemented yet");
};
exports.getTableAndColumnsName = getTableAndColumnsName;
const formatSqlResponseToSimpleTableString = (rawResult) => {
    if (!rawResult || !Array.isArray(rawResult) || rawResult.length === 0) {
        return "";
    }
    let globalString = "";
    for (const oneRow of rawResult) {
        globalString += `${Object.values(oneRow).reduce((completeString, columnValue) => `${completeString} ${columnValue}`, "")}\n`;
    }
    return globalString;
};
const generateTableInfoFromTables = async (tables, appDataSource, nbSampleRow, customDescription) => {
    if (!tables) {
        return "";
    }
    let globalString = "";
    for (const currentTable of tables) {
        // Add the custom info of the table
        const tableCustomDescription = customDescription &&
            Object.keys(customDescription).includes(currentTable.tableName)
            ? `${customDescription[currentTable.tableName]}\n`
            : "";
        // Add the creation of the table in SQL
        let schema = null;
        if (appDataSource.options.type === "postgres") {
            schema = appDataSource.options?.schema ?? "public";
        }
        else if (appDataSource.options.type === "sap") {
            schema =
                appDataSource.options?.schema ??
                    appDataSource.options?.username ??
                    "public";
        }
        let sqlCreateTableQuery = schema
            ? `CREATE TABLE "${schema}"."${currentTable.tableName}" (\n`
            : `CREATE TABLE ${currentTable.tableName} (\n`;
        for (const [key, currentColumn] of currentTable.columns.entries()) {
            if (key > 0) {
                sqlCreateTableQuery += ", ";
            }
            sqlCreateTableQuery += `${currentColumn.columnName} ${currentColumn.dataType} ${currentColumn.isNullable ? "" : "NOT NULL"}`;
        }
        sqlCreateTableQuery += ") \n";
        let sqlSelectInfoQuery;
        if (appDataSource.options.type === "mysql") {
            // We use backticks to quote the table names and thus allow for example spaces in table names
            sqlSelectInfoQuery = `SELECT * FROM \`${currentTable.tableName}\` LIMIT ${nbSampleRow};\n`;
        }
        else if (appDataSource.options.type === "postgres") {
            const schema = appDataSource.options?.schema ?? "public";
            sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
        }
        else if (appDataSource.options.type === "mssql") {
            sqlSelectInfoQuery = `SELECT TOP ${nbSampleRow} * FROM [${currentTable.tableName}];\n`;
        }
        else if (appDataSource.options.type === "sap") {
            const schema = appDataSource.options?.schema ??
                appDataSource.options?.username ??
                "public";
            sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
        }
        else {
            sqlSelectInfoQuery = `SELECT * FROM "${currentTable.tableName}" LIMIT ${nbSampleRow};\n`;
        }
        const columnNamesConcatString = `${currentTable.columns.reduce((completeString, column) => `${completeString} ${column.columnName}`, "")}\n`;
        let sample = "";
        try {
            const infoObjectResult = nbSampleRow
                ? await appDataSource.query(sqlSelectInfoQuery)
                : null;
            sample = formatSqlResponseToSimpleTableString(infoObjectResult);
        }
        catch (error) {
            // If the request fails we catch it and only display a log message
            console.log(error);
        }
        globalString = globalString.concat(tableCustomDescription +
            sqlCreateTableQuery +
            sqlSelectInfoQuery +
            columnNamesConcatString +
            sample);
    }
    return globalString;
};
exports.generateTableInfoFromTables = generateTableInfoFromTables;
const getPromptTemplateFromDataSource = (appDataSource) => {
    if (appDataSource.options.type === "postgres") {
        return sql_db_prompt_js_1.SQL_POSTGRES_PROMPT;
    }
    if (appDataSource.options.type === "sqlite") {
        return sql_db_prompt_js_1.SQL_SQLITE_PROMPT;
    }
    if (appDataSource.options.type === "mysql") {
        return sql_db_prompt_js_1.SQL_MYSQL_PROMPT;
    }
    if (appDataSource.options.type === "mssql") {
        return sql_db_prompt_js_1.SQL_MSSQL_PROMPT;
    }
    if (appDataSource.options.type === "sap") {
        return sql_db_prompt_js_1.SQL_SAP_HANA_PROMPT;
    }
    return sql_db_prompt_js_1.DEFAULT_SQL_DATABASE_PROMPT;
};
exports.getPromptTemplateFromDataSource = getPromptTemplateFromDataSource;
