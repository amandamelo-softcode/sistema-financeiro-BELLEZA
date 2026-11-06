import math
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

DATABASE = Path(app.root_path) / "financeiro.db"


@contextmanager
def conectar_banco():
    conexao = sqlite3.connect(DATABASE)
    conexao.row_factory = sqlite3.Row

    try:
        with conexao:
            yield conexao
    finally:
        conexao.close()


def inicializar_banco():
    with conectar_banco() as conexao:
        conexao.execute(
            """
            CREATE TABLE IF NOT EXISTS movimentacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mes TEXT NOT NULL,
                produto1 INTEGER NOT NULL,
                produto2 INTEGER NOT NULL,
                produto3 INTEGER NOT NULL,
                funcionarios INTEGER NOT NULL,
                aluguel REAL NOT NULL,
                energia REAL NOT NULL,
                receita REAL NOT NULL,
                despesas REAL NOT NULL,
                saldo REAL NOT NULL,
                criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def calcular_movimentacao(dados):
    mes = str(dados.get("mes", "")).strip()

    if not mes:
        raise ValueError("Digite o mês antes de salvar.")

    try:
        produto1 = int(dados.get("produto1") or 0)
        produto2 = int(dados.get("produto2") or 0)
        produto3 = int(dados.get("produto3") or 0)
        quantidade_funcionarios = int(
            dados.get("funcionarios") or 0
        )

    except (TypeError, ValueError) as erro:
        raise ValueError(
            "Nas quantidades, digite apenas números inteiros."
        ) from erro

    try:
        despesas2 = float(
            str(dados.get("aluguel") or "0").replace(",", ".")
        )

        despesas3 = float(
            str(dados.get("energia") or "0").replace(",", ".")
        )

    except (TypeError, ValueError) as erro:
        raise ValueError(
            "No aluguel e na energia, digite valores como 120 ou 120,50."
        ) from erro

    valores = (
        produto1,
        produto2,
        produto3,
        quantidade_funcionarios,
        despesas2,
        despesas3,
    )

    if any(
        not math.isfinite(valor) or valor < 0
        for valor in valores
    ):
        raise ValueError(
            "Use valores iguais ou maiores que zero."
        )

    receita_produtos = (
        float(produto1) * 20
        + float(produto2) * 35
        + float(produto3) * 25
    )

    despesas1 = quantidade_funcionarios * 700

    despesas_totais = (
        despesas1
        + despesas2
        + despesas3
    )

    saldo_final = receita_produtos - despesas_totais

    return {
        "mes": mes,
        "produto1": produto1,
        "produto2": produto2,
        "produto3": produto3,
        "funcionarios": quantidade_funcionarios,
        "aluguel": despesas2,
        "energia": despesas3,
        "receita": receita_produtos,
        "despesas": despesas_totais,
        "saldo": saldo_final,
    }


def obter_movimentacao(conexao, movimentacao_id):

    registro = conexao.execute(
        """
        SELECT *
        FROM movimentacoes
        WHERE id = ?
        """,
        (movimentacao_id,),
    ).fetchone()

    if registro is None:
        return None

    movimentacao = dict(registro)

    movimentacao["vendas"] = (
        movimentacao["produto1"]
        + movimentacao["produto2"]
        + movimentacao["produto3"]
    )

    return movimentacao


def salvar_movimentacao(conexao, movimentacao):

    cursor = conexao.execute(
        """
        INSERT INTO movimentacoes (
            mes,
            produto1,
            produto2,
            produto3,
            funcionarios,
            aluguel,
            energia,
            receita,
            despesas,
            saldo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            movimentacao["mes"],
            movimentacao["produto1"],
            movimentacao["produto2"],
            movimentacao["produto3"],
            movimentacao["funcionarios"],
            movimentacao["aluguel"],
            movimentacao["energia"],
            movimentacao["receita"],
            movimentacao["despesas"],
            movimentacao["saldo"],
        ),
    )

    return cursor.lastrowid


# =========================
# PÁGINA PRINCIPAL
# =========================

@app.route("/")
def inicio():
    return render_template("index.html")


# =========================
# DASHBOARD
# =========================

@app.route("/api/dashboard")
def dashboard():

    with conectar_banco() as conexao:

        meses = [
            linha["mes"]
            for linha in conexao.execute(
                """
                SELECT mes
                FROM movimentacoes
                GROUP BY mes
                ORDER BY MAX(criado_em) DESC, mes
                """
            ).fetchall()
        ]

        mes = request.args.get("mes", "")

        if mes not in meses:
            mes = meses[0] if meses else ""

        indicadores = {
            "receita": 0,
            "despesas": 0,
            "saldo": 0,
            "vendas": 0,
        }

        if mes:

            totais = conexao.execute(
                """
                SELECT
                    COALESCE(SUM(receita), 0) AS receita,
                    COALESCE(SUM(despesas), 0) AS despesas,
                    COALESCE(SUM(receita - despesas), 0) AS saldo,
                    COALESCE(
                        SUM(produto1 + produto2 + produto3),
                        0
                    ) AS vendas
                FROM movimentacoes
                WHERE mes = ?
                """,
                (mes,),
            ).fetchone()

            indicadores = dict(totais)

        registros = [
            dict(registro)
            for registro in conexao.execute(
                """
                SELECT *
                FROM movimentacoes
                ORDER BY criado_em DESC, id DESC
                """
            ).fetchall()
        ]

    for registro in registros:

        registro["vendas"] = (
            registro["produto1"]
            + registro["produto2"]
            + registro["produto3"]
        )
        registro["saldo"] = registro["receita"] - registro["despesas"]

    valor_maximo = max(
        indicadores["receita"],
        indicadores["despesas"],
        1
    )

    return jsonify(
        {
            "meses": meses,
            "mes": mes,
            "indicadores": indicadores,
            "grafico": {
                "receita_pct": round(
                    indicadores["receita"]
                    / valor_maximo
                    * 100
                ),

                "despesas_pct": round(
                    indicadores["despesas"]
                    / valor_maximo
                    * 100
                ),
            },
            "registros": registros,
        }
    )


# =========================
# CRIAR MOVIMENTAÇÃO
# =========================

@app.route(
    "/api/movimentacoes",
    methods=["POST"]
)
def criar_movimentacao():

    try:

        movimentacao = calcular_movimentacao(
            request.get_json(silent=True) or {}
        )

    except ValueError as erro:

        return jsonify(
            {
                "erro": str(erro)
            }
        ), 400

    with conectar_banco() as conexao:

        movimentacao_id = salvar_movimentacao(
            conexao,
            movimentacao
        )

    movimentacao["id"] = movimentacao_id

    movimentacao["saldo"] = (
        movimentacao["receita"] - movimentacao["despesas"]
    )

    movimentacao["vendas"] = (
        movimentacao["produto1"]
        + movimentacao["produto2"]
        + movimentacao["produto3"]
    )

    return jsonify(
        {
            "mensagem": "Lançamento salvo com sucesso.",
            "movimentacao": movimentacao,
        }
    ), 201


# =========================
# EDITAR OU EXCLUIR
# =========================

@app.route(
    "/api/movimentacoes/<int:movimentacao_id>",
    methods=["PUT", "DELETE"]
)
def movimentacao_api(movimentacao_id):

    # EXCLUIR
    if request.method == "DELETE":

        with conectar_banco() as conexao:

            cursor = conexao.execute(
                """
                DELETE FROM movimentacoes
                WHERE id = ?
                """,
                (movimentacao_id,),
            )

        if cursor.rowcount == 0:

            return jsonify(
                {
                    "erro": "Esse lançamento não existe."
                }
            ), 404

        return jsonify(
            {
                "mensagem": "Lançamento excluído com sucesso."
            }
        )

    # EDITAR
    try:

        movimentacao = calcular_movimentacao(
            request.get_json(silent=True) or {}
        )

    except ValueError as erro:

        return jsonify(
            {
                "erro": str(erro)
            }
        ), 400

    with conectar_banco() as conexao:

        cursor = conexao.execute(
            """
            UPDATE movimentacoes
            SET
                mes = ?,
                produto1 = ?,
                produto2 = ?,
                produto3 = ?,
                funcionarios = ?,
                aluguel = ?,
                energia = ?,
                receita = ?,
                despesas = ?,
                saldo = ?
            WHERE id = ?
            """,
            (
                movimentacao["mes"],
                movimentacao["produto1"],
                movimentacao["produto2"],
                movimentacao["produto3"],
                movimentacao["funcionarios"],
                movimentacao["aluguel"],
                movimentacao["energia"],
                movimentacao["receita"],
                movimentacao["despesas"],
                movimentacao["saldo"],
                movimentacao_id,
            ),
        )

        registro = obter_movimentacao(
            conexao,
            movimentacao_id
        )

    if cursor.rowcount == 0 or registro is None:

        return jsonify(
            {
                "erro": "Não encontramos esse lançamento."
            }
        ), 404

    return jsonify(
        {
            "mensagem": "Lançamento atualizado com sucesso.",
            "movimentacao": registro,
        }
    )


# =========================
# INICIALIZA BANCO
# =========================

inicializar_banco()


if __name__ == "__main__":
    app.run(debug=True)