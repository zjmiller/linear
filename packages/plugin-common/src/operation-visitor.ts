import autoBind from "auto-bind";
import { DocumentNode, FieldDefinitionNode, Kind, ObjectTypeDefinitionNode } from "graphql";
import { isScalarField } from "./field";
import { printOperations } from "./operation";
import { OperationType, PluginContext } from "./types";
import { filterJoin, getKeyByValue } from "./utils";

/**
 * Graphql-codegen visitor for processing the ast and generating operations
 */
export class OperationVisitor {
  private _context: PluginContext;

  /** Initialize the visitor */
  public constructor(context: PluginContext) {
    autoBind(this);

    this._context = context;
  }

  public Document = {
    /** Join all string definitions */
    leave: (node: DocumentNode): string => {
      return filterJoin(
        (node.definitions ?? []).map(x => (typeof x === "string" ? x : "")),
        "\n"
      );
    },
  };

  public ObjectTypeDefinition = {
    /** Filter for operation types only */
    enter: (node: ObjectTypeDefinitionNode): (ObjectTypeDefinitionNode & { operationType: OperationType }) | null => {
      const operationType = getKeyByValue(this._context.operationMap, node.name.value);
      return operationType ? { ...node, operationType } : null;
    },

    /** Print all field operations */
    leave: (_node: ObjectTypeDefinitionNode): string | null => {
      const node = (_node as unknown) as ObjectTypeDefinitionNode & { operationType: OperationType };
      return filterJoin(
        node.fields?.map(field => {
          return field ? printOperations(this._context, node.operationType, [field]) : undefined;
        }),
        "\n\n"
      );
    },
  };

  public FieldDefinition = {
    /** Filter for non scalar fields only */
    enter: (node: FieldDefinitionNode): (FieldDefinitionNode & { nullable: boolean }) | null => {
      if (isScalarField(this._context.scalars, node)) {
        return null;
      } else {
        return { ...node, nullable: node.type.kind !== Kind.NON_NULL_TYPE };
      }
    },
  };
}