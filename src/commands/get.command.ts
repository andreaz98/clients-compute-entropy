import * as program from 'commander';

import { CipherType } from 'jslib/enums/cipherType';

import { CipherService } from 'jslib/abstractions/cipher.service';
import { CollectionService } from 'jslib/abstractions/collection.service';
import { FolderService } from 'jslib/abstractions/folder.service';
import { PasswordGenerationService } from 'jslib/abstractions/passwordGeneration.service';
import { SyncService } from 'jslib/abstractions/sync.service';
import { TotpService } from 'jslib/abstractions/totp.service';

import { Response } from '../models/response';
import { CipherResponse } from '../models/response/cipherResponse';
import { CollectionResponse } from '../models/response/collectionResponse';
import { FolderResponse } from '../models/response/folderResponse';
import { StringResponse } from '../models/response/stringResponse';
import { TemplateResponse } from '../models/response/templateResponse';

import { Card } from '../models/card';
import { Cipher } from '../models/cipher';
import { Collection } from '../models/collection';
import { Field } from '../models/field';
import { Folder } from '../models/folder';
import { Identity } from '../models/identity';
import { Login } from '../models/login';
import { LoginUri } from '../models/loginUri';
import { SecureNote } from '../models/secureNote';

export class GetCommand {
    constructor(private cipherService: CipherService, private folderService: FolderService,
        private collectionService: CollectionService, private totpService: TotpService,
        private syncService: SyncService, private passwordGenerationService: PasswordGenerationService) { }

    async run(object: string, id: string, cmd: program.Command): Promise<Response> {
        if (id == null && object !== 'lastsync' && object !== 'password') {
            return Response.badRequest('`id` argument is required.');
        }

        switch (object.toLowerCase()) {
            case 'item':
                return await this.getCipher(id);
            case 'totp':
                return await this.getTotp(id);
            case 'folder':
                return await this.getFolder(id);
            case 'collection':
                return await this.getCollection(id);
            case 'template':
                return await this.getTemplate(id);
            case 'lastsync':
                return await this.getLastSync();
            case 'password':
                return await this.getPassword(cmd);
            default:
                return Response.badRequest('Unknown object.');
        }
    }

    private async getCipher(id: string) {
        const cipher = await this.cipherService.get(id);
        if (cipher == null) {
            return Response.notFound();
        }

        const decCipher = await cipher.decrypt();
        const res = new CipherResponse(decCipher);
        return Response.success(res);
    }

    private async getTotp(id: string) {
        const cipher = await this.cipherService.get(id);
        if (cipher == null) {
            return Response.notFound();
        }

        if (cipher.type !== CipherType.Login) {
            return Response.badRequest('Not a login.');
        }

        const decCipher = await cipher.decrypt();
        if (decCipher.login.totp == null || decCipher.login.totp === '') {
            return Response.error('No TOTP available for this login.');
        }

        const totp = await this.totpService.getCode(decCipher.login.totp);
        if (totp == null) {
            return Response.error('Couldn\'t generate TOTP code.');
        }

        const res = new StringResponse(totp);
        return Response.success(res);
    }

    private async getFolder(id: string) {
        const folder = await this.folderService.get(id);
        if (folder == null) {
            return Response.notFound();
        }

        const decFolder = await folder.decrypt();
        const res = new FolderResponse(decFolder);
        return Response.success(res);
    }

    private async getCollection(id: string) {
        const collection = await this.collectionService.get(id);
        if (collection == null) {
            return Response.notFound();
        }

        const decCollection = await collection.decrypt();
        const res = new CollectionResponse(decCollection);
        return Response.success(res);
    }

    private async getTemplate(id: string) {
        let template: any = null;
        switch (id.toLowerCase()) {
            case 'item':
                template = Cipher.template();
                break;
            case 'field':
                template = Field.template();
                break;
            case 'login':
                template = Login.template();
                break;
            case 'loginuri':
                template = LoginUri.template();
                break;
            case 'card':
                template = Card.template();
                break;
            case 'identity':
                template = Identity.template();
                break;
            case 'securenote':
                template = SecureNote.template();
                break;
            case 'folder':
                template = Folder.template();
                break;
            case 'collection':
                template = Collection.template();
                break;
            default:
                return Response.badRequest('Unknown template object.');
        }

        const res = new TemplateResponse(template);
        return Response.success(res);
    }

    private async getLastSync() {
        const lastSyncDate = await this.syncService.getLastSync();
        const res = new StringResponse(lastSyncDate == null ? null : lastSyncDate.toISOString());
        return Response.success(res);
    }

    private async getPassword(cmd: program.Command) {
        const options = {
            uppercase: cmd.uppercase || false,
            lowercase: cmd.lowercase || false,
            number: cmd.number || false,
            special: cmd.special || false,
            length: cmd.length || 14,
        };
        if (!options.uppercase && !options.lowercase && !options.special && !options.number) {
            options.lowercase = true;
            options.uppercase = true;
            options.number = true;
        }
        if (options.length < 5) {
            options.length = 5;
        }
        const password = await this.passwordGenerationService.generatePassword(options);
        const res = new StringResponse(password);
        return Response.success(res);
    }
}
