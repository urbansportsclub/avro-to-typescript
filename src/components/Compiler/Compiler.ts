import * as fs from "fs";
import * as path from "path";
import {DirHelper} from "../../helpers/DirHelper";
import {TypeHelper} from "../../helpers/TypeHelper";
import {CompilerOutput} from "../../interfaces/CompilerOutput";
import {ExportModel} from "../../models/ExportModel";
import {ClassConverter} from "../Converters/ClassConverter";
import {BaseCompiler} from "./base/BaseCompiler";
import {EnumConverter} from "../..";

export class Compiler extends BaseCompiler {
    public exports: ExportModel[];

    public constructor(outputDir: string, public logicalTypes?: { [key: string]: string }) {
        super();

        this.classPath = path.resolve(outputDir);
    }

    public async compileFolder(schemaPath: string): Promise<void> {
        try {
            fs.readdir(schemaPath, async (err, files) => {
                for (const file of files) {
                    const fullPath = schemaPath + path.sep + file;

                    if (fs.statSync(fullPath).isDirectory()) {
                        await this.compileFolder(fullPath);
                        continue;
                    }

                    const data = fs.readFileSync(fullPath).toString();

                    await this.compile(data);
                }
            });
        } catch (err) {
            console.log(err);
        }
    }

    public async compile(data: any): Promise<CompilerOutput> {
        const enumConverter = new EnumConverter(this.logicalTypes);
        const classConverter = new ClassConverter(this.logicalTypes);
        data = classConverter.getData(data);

        const namespace = data.namespace.replace(/\./g, path.sep);
        const outputDir = `${this.classPath}${path.sep}${namespace}`;

        DirHelper.mkdirIfNotExist(outputDir);
        this.saveBaseAvroRecord();

        if (TypeHelper.isRecordType(data)) {
            classConverter.convert(data);
            this.saveClass(outputDir, data, classConverter.joinExports());
        } else if (TypeHelper.isEnumType(data)) {
            const enumModel = enumConverter.convert(data);
            this.saveEnum(enumModel, outputDir);
        }

        console.log(`Wrote ${data.name}.ts in ${outputDir}`);

        return {
            class: data.name,
            dir: outputDir,
        };
    }

    protected saveClass(outputDir: string, data: any, result: string) {
        const classFile = `${outputDir}${path.sep}${data.name}.ts`;
        fs.writeFileSync(classFile, result);
    }

    protected saveEnum(enumModel: ExportModel, outputDir: string) {
        const savePath = `${outputDir}${path.sep}${enumModel.name}.ts`;
        fs.writeFileSync(savePath, enumModel.content);
    }

    protected saveBaseAvroRecord() {
        const avroRecordPath = `${this.classPath}${path.sep}BaseAvroRecord.ts`;

        if (!fs.existsSync(avroRecordPath)) {
            fs.writeFileSync(
                avroRecordPath,
                "export { BaseAvroRecord } from \"@onefit/avro-to-typescript\";\n",
            );
        }
    }
}
