import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { transactionSchema, resourceNames } from "@/contracts/resources";
import { ok } from "@/lib/api";
export function GET(){const registry=new OpenAPIRegistry();registry.register("TransactionInput",transactionSchema);for(const resource of resourceNames)registry.registerPath({method:"get",path:`/api/v1/${resource}`,summary:`List ${resource}`,responses:{200:{description:"Cursor-paginated owner-scoped records"}},security:[{bearerAuth:[]},{cookieAuth:[]}]});registry.registerComponent("securitySchemes","bearerAuth",{type:"http",scheme:"bearer",bearerFormat:"JWT"});registry.registerComponent("securitySchemes","cookieAuth",{type:"apiKey",in:"cookie",name:"pocketlog_access"});const document=new OpenApiGeneratorV3(registry.definitions).generateDocument({openapi:"3.0.3",info:{title:"PocketLog API",version:"1.0.0"},servers:[{url:"/"}]});return ok(document)}

