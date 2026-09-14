from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from database.models import SavingsGoal, db

goal_routes = Blueprint(
    "goal_routes",
    __name__,
)


@goal_routes.route("/goals", methods=["POST"])
@jwt_required()
def add_goal():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "Goal data is required"
        }), 400

    name = data.get("name", "").strip()
    target_amount = data.get("target_amount")
    deadline = data.get("deadline", "").strip()

    if not name or not target_amount or not deadline:
        return jsonify({
            "error": "Name, target amount and deadline are required"
        }), 400

    try:
        target_amount = float(target_amount)

        if target_amount <= 0:
            raise ValueError

        converted_deadline = date.fromisoformat(deadline)

    except (ValueError, TypeError):
        return jsonify({
            "error": "Enter a valid amount and date"
        }), 400

    user_id = int(get_jwt_identity())

    goal = SavingsGoal()
    goal.name = name
    goal.target_amount = target_amount
    goal.current_saved = 0
    goal.deadline = converted_deadline
    goal.user_id = user_id

    db.session.add(goal)
    db.session.commit()

    return jsonify({
        "message": "Savings goal created successfully",
        "goal": {
            "id": goal.id,
            "name": goal.name,
            "target_amount": goal.target_amount,
            "current_saved": goal.current_saved,
            "deadline": goal.deadline.isoformat(),
            "progress_percentage": 0
        }
    }), 201


@goal_routes.route("/goals", methods=["GET"])
@jwt_required()
def get_goals():
    user_id = int(get_jwt_identity())

    goals = SavingsGoal.query.filter_by(
        user_id=user_id
    ).order_by(SavingsGoal.deadline).all()

    results = []

    for goal in goals:
        progress = (
            goal.current_saved / goal.target_amount
        ) * 100

        results.append({
            "id": goal.id,
            "name": goal.name,
            "target_amount": goal.target_amount,
            "current_saved": goal.current_saved,
            "deadline": goal.deadline.isoformat(),
            "progress_percentage": round(progress, 2)
        })

    return jsonify({
        "goals": results
    }), 200

@goal_routes.route(
    "/goals/<int:goal_id>/progress",
    methods=["PATCH"]
)
@jwt_required()
def update_goal_progress(goal_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "Saved amount is required"
        }), 400

    amount_to_add = data.get("amount")

    try:
        amount_to_add = float(amount_to_add)

        if amount_to_add <= 0:
            raise ValueError

    except (ValueError, TypeError):
        return jsonify({
            "error": "Enter a valid amount greater than zero"
        }), 400

    goal = SavingsGoal.query.filter_by(
        id=goal_id,
        user_id=user_id
    ).first()

    if not goal:
        return jsonify({
            "error": "Savings goal not found"
        }), 404

    new_saved_amount = (
        goal.current_saved + amount_to_add
    )

    if new_saved_amount > goal.target_amount:
        return jsonify({
            "error": "Saved amount cannot exceed the target amount"
        }), 400

    goal.current_saved = new_saved_amount
    db.session.commit()

    progress = (
        goal.current_saved / goal.target_amount
    ) * 100

    return jsonify({
        "message": "Goal progress updated successfully",
        "goal": {
            "id": goal.id,
            "name": goal.name,
            "target_amount": goal.target_amount,
            "current_saved": goal.current_saved,
            "remaining_amount": (
                goal.target_amount - goal.current_saved
            ),
            "deadline": goal.deadline.isoformat(),
            "progress_percentage": round(progress, 2)
        }
    }), 200

@goal_routes.route(
    "/goals/<int:goal_id>",
    methods=["DELETE"]
)
@jwt_required()
def delete_goal(goal_id):
    user_id = int(get_jwt_identity())

    goal = SavingsGoal.query.filter_by(
        id=goal_id,
        user_id=user_id
    ).first()

    if not goal:
        return jsonify({
            "error": "Savings goal not found"
        }), 404

    db.session.delete(goal)
    db.session.commit()

    return jsonify({
        "message": "Savings goal deleted successfully"
    }), 200


@goal_routes.route("/goals/<int:goal_id>", methods=["PUT"])
@jwt_required()
def update_goal(goal_id):
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True)

    goal = SavingsGoal.query.filter_by(
        id=goal_id,
        user_id=user_id
    ).first()

    if not goal:
        return jsonify({
            "error": "Goal not found"
        }), 404

    if not data or "current_saved" not in data:
        return jsonify({
            "error": "Current saved amount is required"
        }), 400

    try:
        current_saved = float(data["current_saved"])

        if current_saved < 0:
            raise ValueError

    except (ValueError, TypeError):
        return jsonify({
            "error": "Enter a valid amount"
        }), 400

    goal.current_saved = current_saved
    db.session.commit()

    return jsonify({
        "message": "Savings added successfully",
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_saved": goal.current_saved,
        "deadline": goal.deadline.isoformat()
    }), 200