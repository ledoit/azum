let upper s = String.uppercase_ascii s

let col_to_index col =
  let n = ref 0 in
  String.iter
    (fun ch -> n := !n * 26 + (Char.code (Char.uppercase_ascii ch) - 64))
    col;
  !n - 1

let index_to_col index =
  let n = ref (index + 1) in
  let buf = Buffer.create 2 in
  while !n > 0 do
    let rem = (!n - 1) mod 26 in
    Buffer.add_char buf (Char.chr (65 + rem));
    n := (!n - 1) / 26
  done;
  let s = Buffer.contents buf in
  let len = String.length s in
  String.init len (fun i -> s.[len - 1 - i])

let parse_address addr =
  let addr = String.trim addr in
  let len = String.length addr in
  let i = ref 0 in
  while !i < len && Char.code addr.[!i] >= 65 && Char.code (Char.uppercase_ascii addr.[!i]) <= 90 do
    incr i
  done;
  if !i = 0 || !i = len then None
  else
    try
      let col = String.sub addr 0 !i in
      let row = int_of_string (String.sub addr !i (len - !i)) in
      Some (col_to_index col, row - 1)
    with _ -> None

let cell_map cells =
  List.fold_left
    (fun acc (k, v) -> (upper k, v) :: acc)
    [] cells

let find_cell map addr =
  let key = upper addr in
  match List.assoc_opt key map with
  | Some v -> v
  | None -> ""

let rec eval_formula formula map visiting =
  let body =
    let f = String.trim formula in
    if String.length f > 0 && f.[0] = '=' then
      String.trim (String.sub f 1 (String.length f - 1))
    else f
  in
  if body = "" then "null"
  else
    try
      (* Minimal: number, A1, A1+B1, SUM(A1:B2) — keep parity with TS fallback. *)
      let get_num addr =
        let a = upper addr in
        if List.mem a visiting then failwith "cycle";
        let raw = find_cell map a in
        if raw = "" then 0.
        else if String.length raw > 0 && raw.[0] = '=' then
          match float_of_string_opt (eval_formula raw map (a :: visiting)) with
          | Some n -> n
          | None -> 0.
        else
          match float_of_string_opt (String.trim raw) with
          | Some n -> n
          | None -> 0.
      in
      let sum_range r =
        match String.split_on_char ':' r with
        | [a] -> get_num a
        | [a; b] ->
            (match parse_address a, parse_address b with
            | Some (c1, r1), Some (c2, r2) ->
                let total = ref 0. in
                for row = min r1 r2 to max r1 r2 do
                  for col = min c1 c2 to max c1 c2 do
                    let addr = Printf.sprintf "%s%d" (index_to_col col) (row + 1) in
                    total := !total +. get_num addr
                  done
                done;
                !total
            | _ -> 0.)
        | _ -> 0.
      in
      let re_sum = Str.regexp_case_fold "^SUM(\\([^)]+\\))$" in
      let re_bin = Str.regexp "^\\([A-Za-z]+[0-9]+\\)[ ]*\\([+\\-*/]\\)[ ]*\\([A-Za-z]+[0-9]+\\)$" in
      let re_ref = Str.regexp "^\\([A-Za-z]+[0-9]+\\)$" in
      if Str.string_match re_sum body 0 then
        let args = Str.split (Str.regexp ",") (Str.matched_group 1 body) in
        let total = List.fold_left (fun acc a -> acc +. sum_range (String.trim a)) 0. args in
        string_of_float total
      else if Str.string_match re_bin body 0 then
        let a = Str.matched_group 1 body in
        let op = Str.matched_group 2 body in
        let b = Str.matched_group 3 body in
        let x = get_num a and y = get_num b in
        let v =
          match op with
          | "+" -> x +. y
          | "-" -> x -. y
          | "*" -> x *. y
          | "/" -> if y = 0. then nan else x /. y
          | _ -> nan
        in
        string_of_float v
      else if Str.string_match re_ref body 0 then
        string_of_float (get_num (Str.matched_group 1 body))
      else
        match float_of_string_opt body with
        | Some n -> string_of_float n
        | None -> "#ERROR!"
    with
    | Failure "cycle" -> "#CYCLE!"
    | _ -> "#ERROR!"

let evaluate ~formula ~cells =
  let map = cell_map cells in
  eval_formula formula map []

let create_empty_json name =
  Printf.sprintf
    {|{"version":1,"name":%S,"activeSheet":0,"sheets":[{"name":"Sheet1","cells":{}}]}|}
    name

let from_csv text sheet_name =
  (* CSV → JSON is primarily handled in TS; stub returns empty sheet with name. *)
  Printf.sprintf
    {|{"version":1,"name":"Workbook","activeSheet":0,"sheets":[{"name":%S,"cells":{}}]}|}
    sheet_name

let to_csv_from_cells _cells = ""
