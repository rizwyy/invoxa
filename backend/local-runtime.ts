import { LocalRepository } from './adapters/local'
import { LocalFiles } from './adapters/local-files'
import { LocalAuth } from './local-auth'
import { InvoiceService } from './service'
export const localRepo = new LocalRepository()
export const localFiles = new LocalFiles(localRepo.directory)
export const localAuth = new LocalAuth(localRepo)
export const localService = new InvoiceService(localRepo, localFiles)
