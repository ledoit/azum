(** Workbook helpers and a small formula evaluator (A1 refs, arithmetic, SUM). *)

val evaluate : formula:string -> cells:(string * string) list -> string
val create_empty_json : string -> string
val from_csv : string -> string -> string
val to_csv_from_cells : (string * string) list -> string
